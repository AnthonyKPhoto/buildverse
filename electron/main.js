"use strict";

process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE') return;
  try { require('electron').dialog.showErrorBox('BuildVerse - Fatal Error', `Failed to start:\n\n${err.message}`); } catch {}
  process.exit(1);
});
"use strict";

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog } = require("electron");
let autoUpdater = null;
try { autoUpdater = require("electron-updater").autoUpdater; } catch (_) { /* not bundled — updates disabled */ }
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const http = require("http");
const https = require("https");
const os = require("os");
const fs = require("fs");

// ──────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────
const IS_DEV = !app.isPackaged;
const PORT = IS_DEV ? 3000 : 3456;
const APP_NAME = "BuildVerse";

let mainWindow = null;
let tray = null;
let serverProcess = null;

app.isQuitting = false;

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function waitForServer(url, maxMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode < 500) return resolve();
        schedule();
      });
      req.on("error", schedule);
      req.setTimeout(2000, () => { req.destroy(); schedule(); });
    }
    function schedule() {
      if (Date.now() - start > maxMs) return reject(new Error("Server startup timed out"));
      setTimeout(attempt, 800);
    }
    attempt();
  });
}

function iconPath(preferIco = false) {
  if (IS_DEV) {
    const base = path.join(__dirname, "..", "build");
    const ico  = path.join(base, "icon.ico");
    const png  = path.join(base, "icon.png");
    return (preferIco && fs.existsSync(ico)) ? ico : (fs.existsSync(png) ? png : ico);
  }
  const base = process.resourcesPath;
  const ico  = path.join(base, "icon.ico");
  const png  = path.join(base, "icon.png");
  return (preferIco && fs.existsSync(ico)) ? ico : (fs.existsSync(png) ? png : ico);
}

function loadIcon(size) {
  // On Windows prefer ICO for title bar / taskbar (best multi-resolution support)
  const p = iconPath(process.platform === "win32");
  if (!p || !fs.existsSync(p)) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(p);
  return size ? img.resize({ width: size, height: size }) : img;
}

// ──────────────────────────────────────────────────────────
// Database bootstrap
// ──────────────────────────────────────────────────────────

/**
 * Returns true when the SQLite file at dbPath has at least one user-created
 * table (i.e. more than 1 page in the file — page 1 is the schema page, every
 * additional page means real content).  An uninitialised copy of the template
 * would have pageCount === 1 or an invalid header.
 */
function isDatabaseInitialized(dbPath) {
  if (!fs.existsSync(dbPath)) return false;
  try {
    const buf = Buffer.alloc(32);
    const fd = fs.openSync(dbPath, "r");
    const bytesRead = fs.readSync(fd, buf, 0, 32, 0);
    fs.closeSync(fd);
    if (bytesRead < 32) return false;
    // SQLite magic header: first 16 bytes are "SQLite format 3\0"
    if (buf.toString("ascii", 0, 6) !== "SQLite") return false;
    // Page count is a 4-byte big-endian integer at offset 28
    const pageCount = buf.readUInt32BE(28);
    return pageCount > 1;
  } catch {
    return false;
  }
}

function ensureDatabase() {
  const userDataDir = app.getPath("userData");
  const dbDest = path.join(userDataDir, "buildverse.db");

  const template = IS_DEV
    ? path.join(__dirname, "..", "prisma", "dev.db")
    : path.join(process.resourcesPath, "prisma", "dev.db");

  // Copy template if DB doesn't exist yet
  if (!fs.existsSync(dbDest)) {
    if (fs.existsSync(template)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.copyFileSync(template, dbDest);
      console.log(`[buildverse] Initialised database at ${dbDest}`);
    } else {
      console.warn("[buildverse] No database template found; starting with empty DB");
    }
  }

  // Safety check: if the DB file exists but has no tables (schema was never
  // applied — typically from a broken template or empty SQLite file), wipe it
  // and re-copy from the template so Prisma doesn't crash on startup.
  if (!isDatabaseInitialized(dbDest)) {
    console.warn("[buildverse] Database exists but has no schema — re-initialising from template");
    try { fs.unlinkSync(dbDest); } catch {}
    if (fs.existsSync(template) && isDatabaseInitialized(template)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.copyFileSync(template, dbDest);
      console.log(`[buildverse] Re-initialised database from template`);
    } else {
      // Template itself is broken — log clearly so we know what happened
      console.error("[buildverse] Template DB also lacks schema. The app may not work correctly until reinstalled.");
    }
  }

  return dbDest;
}

// ──────────────────────────────────────────────────────────
// Backup system
// ──────────────────────────────────────────────────────────

function getBackupsDir() {
  return path.join(app.getPath("userData"), "backups");
}

function getBackupListRaw() {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith("buildverse-") && f.endsWith(".db"))
    .map((f) => {
      const filePath = path.join(dir, f);
      const stat = fs.statSync(filePath);
      return { name: f, filePath, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function autoBackupOnStartup(dbPath) {
  if (!fs.existsSync(dbPath)) return;
  const dir = getBackupsDir();
  fs.mkdirSync(dir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const existing = getBackupListRaw();
  const hasToday = existing.some((b) => b.name.includes(today));

  if (!hasToday) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = path.join(dir, `buildverse-${stamp}.db`);
    try {
      fs.copyFileSync(dbPath, dest);
      console.log(`[buildverse] Auto-backup: ${dest}`);
    } catch (err) {
      console.error("[buildverse] Auto-backup failed:", err.message);
    }
  }

  const all = getBackupListRaw();
  if (all.length > 10) {
    all.slice(10).forEach((b) => {
      try { fs.unlinkSync(b.filePath); } catch {}
    });
  }
}

ipcMain.handle("backup:create", () => {
  const dbPath = path.join(app.getPath("userData"), "buildverse.db");
  if (!fs.existsSync(dbPath)) throw new Error("Database not found");
  const dir = getBackupsDir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(dir, `buildverse-${stamp}.db`);
  fs.copyFileSync(dbPath, dest);
  return { success: true, filePath: dest };
});

ipcMain.handle("backup:list", () => getBackupListRaw());

ipcMain.handle("backup:restore", async (_, rawPath) => {
  const safeFile = path.resolve(rawPath);
  const safeBase = path.resolve(getBackupsDir());
  if (!safeFile.startsWith(safeBase + path.sep)) throw new Error("Invalid path");
  if (!fs.existsSync(safeFile)) throw new Error("Backup file not found");

  const dbPath = path.join(app.getPath("userData"), "buildverse.db");

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  await new Promise((r) => setTimeout(r, 1500));

  fs.copyFileSync(safeFile, dbPath);
  app.relaunch();
  app.isQuitting = true;
  app.quit();
  return { success: true };
});

ipcMain.handle("backup:delete", (_, rawPath) => {
  const safeFile = path.resolve(rawPath);
  const safeBase = path.resolve(getBackupsDir());
  if (!safeFile.startsWith(safeBase + path.sep)) throw new Error("Invalid path");
  fs.unlinkSync(safeFile);
  return { success: true };
});

// ──────────────────────────────────────────────────────────
// Network helpers
// ──────────────────────────────────────────────────────────

function getLanIp() {
  try {
    const interfaces = os.networkInterfaces();
    for (const ifaces of Object.values(interfaces)) {
      for (const iface of (ifaces || [])) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
  } catch {}
  return null;
}

ipcMain.handle("network:getLanUrl", () => {
  const ip = getLanIp();
  return ip ? `http://${ip}:${PORT}` : null;
});

ipcMain.handle("capture:build-card", async (event, rect) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    const image = await mainWindow.webContents.capturePage(rect);
    return image.toPNG().toString("base64");
  } catch {
    return null;
  }
});

ipcMain.handle("network:setLanAccess", (_, enabled) => {
  savePrefs({ lanAccess: !!enabled });
  return { success: true, requiresRestart: true };
});

// ──────────────────────────────────────────────────────────
// Transfer pack (ZIP export / import)
// ──────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

ipcMain.handle("transfer:export-zip", async () => {
  const userData = app.getPath("userData");
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save BuildVerse Transfer Pack",
    defaultPath: `BuildVerse-export-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
  });
  if (canceled || !filePath) return { canceled: true };

  const tmpDir = path.join(userData, "_bv_export_tmp");
  try {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const dbSrc = path.join(userData, "buildverse.db");
    if (fs.existsSync(dbSrc)) fs.copyFileSync(dbSrc, path.join(tmpDir, "buildverse.db"));

    for (const dir of ["vehicle-files", "tune-logs"]) {
      const src = path.join(userData, dir);
      if (fs.existsSync(src)) copyDirSync(src, path.join(tmpDir, dir));
    }

    fs.writeFileSync(path.join(tmpDir, "manifest.json"), JSON.stringify({
      app: "BuildVerse", version: app.getVersion(), exportedAt: new Date().toISOString(),
    }));

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    execFileSync("powershell.exe", [
      "-NonInteractive", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
      `Add-Type -Assembly System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${tmpDir.replace(/'/g, "''")}', '${filePath.replace(/'/g, "''")}')`,
    ], { timeout: 120000 });

    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

ipcMain.handle("transfer:import-zip", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import BuildVerse Transfer Pack",
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return { canceled: true };

  const userData = app.getPath("userData");
  const tmpDir = path.join(userData, "_bv_import_tmp");
  try {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    execFileSync("powershell.exe", [
      "-NonInteractive", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
      `Add-Type -Assembly System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${filePaths[0].replace(/'/g, "''")}', '${tmpDir.replace(/'/g, "''")}')`,
    ], { timeout: 120000 });

    let baseDir = tmpDir;
    if (!fs.existsSync(path.join(tmpDir, "buildverse.db"))) {
      const entries = fs.readdirSync(tmpDir, { withFileTypes: true }).filter(e => e.isDirectory());
      if (entries.length === 1) baseDir = path.join(tmpDir, entries[0].name);
    }
    if (!fs.existsSync(path.join(baseDir, "buildverse.db"))) {
      return { success: false, error: "Invalid export file — buildverse.db not found" };
    }

    if (serverProcess && !serverProcess.killed) { serverProcess.kill("SIGTERM"); serverProcess = null; }
    await new Promise(r => setTimeout(r, 1000));

    fs.copyFileSync(path.join(baseDir, "buildverse.db"), path.join(userData, "buildverse.db"));
    for (const dir of ["vehicle-files", "tune-logs"]) {
      const src = path.join(baseDir, dir);
      if (fs.existsSync(src)) {
        const dest = path.join(userData, dir);
        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
        copyDirSync(src, dest);
      }
    }

    app.relaunch(); app.isQuitting = true; app.quit();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

// ──────────────────────────────────────────────────────────
// Auto-updater
// ──────────────────────────────────────────────────────────

function sendUpdateStatus(status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", { status, ...extra });
  }
}

function checkGitHubVersion() {
  return new Promise((resolve) => {
    try {
      const req = https.get({
        hostname: "api.github.com",
        path: "/repos/AnthonyKPhoto/buildverse/releases/latest",
        headers: { "User-Agent": `BuildVerse/${app.getVersion()}`, "Accept": "application/vnd.github.v3+json" },
        timeout: 8000,
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data).tag_name || null); } catch { resolve(null); }
        });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    } catch { resolve(null); }
  });
}

function compareVersions(a, b) {
  const parse = (s) => String(s).replace(/^v/, "").split(".").map(Number);
  const [av, bv] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const d = (av[i] || 0) - (bv[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

async function checkGitHubForUpdates() {
  try {
    const latestTag = await checkGitHubVersion();
    if (!latestTag) return;
    if (compareVersions(latestTag, `v${app.getVersion()}`) > 0) {
      sendUpdateStatus("available", {
        version: latestTag.replace(/^v/, ""),
        downloadUrl: "https://github.com/AnthonyKPhoto/buildverse/releases/latest",
        manual: true,
      });
    } else {
      sendUpdateStatus("current");
    }
  } catch {}
}

function initAutoUpdater() {
  if (!autoUpdater) {
    setTimeout(() => checkGitHubForUpdates(), 5000);
    return;
  }
  if (IS_DEV) {
    setTimeout(() => checkGitHubForUpdates(), 5000);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", (info) => sendUpdateStatus("available", { version: info.version }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus("current"));
  autoUpdater.on("error", async (err) => {
    console.error("[updater]", err?.message || err);
    await checkGitHubForUpdates();
  });
  autoUpdater.on("download-progress", (p) => sendUpdateStatus("downloading", { percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus("downloaded", { version: info.version }));

  // Initial check 5 seconds after launch — fall back to GitHub API if electron-updater fails
  setTimeout(async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      await checkGitHubForUpdates();
    }
  }, 5000);

  // Recurring check every hour
  setInterval(async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      await checkGitHubForUpdates();
    }
  }, 60 * 60 * 1000);
}

ipcMain.handle("update:check", async () => {
  sendUpdateStatus("checking");
  if (!autoUpdater || IS_DEV) { await checkGitHubForUpdates(); return; }
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    await checkGitHubForUpdates();
  }
});

ipcMain.handle("update:install", () => {
  if (IS_DEV || !autoUpdater) return;
  autoUpdater.quitAndInstall(false, true);
});

// ──────────────────────────────────────────────────────────
// Find Node.js executable (NOT process.execPath — that's Electron)
// ──────────────────────────────────────────────────────────

function findNodeExecutable() {
  // 1. Node binary bundled alongside the app (most reliable)
  const bundled = path.join(process.resourcesPath, "node.exe");
  if (fs.existsSync(bundled)) return bundled;

  // 2. Walk PATH entries
  const sep = process.platform === "win32" ? ";" : ":";
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  for (const dir of (process.env.PATH || "").split(sep)) {
    const candidate = path.join(dir.trim(), nodeName);
    try { if (fs.existsSync(candidate)) return candidate; } catch {}
  }

  // 3. Common Windows install locations
  const winCandidates = [
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Program Files (x86)\\nodejs\\node.exe",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "nodejs", "node.exe"),
    path.join(process.env.APPDATA || "", "..", "Local", "Programs", "nodejs", "node.exe"),
  ];
  for (const c of winCandidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }

  return null;
}

// ──────────────────────────────────────────────────────────
// Next.js server (production only)
// ──────────────────────────────────────────────────────────

async function startServer(dbPath) {
  if (IS_DEV) return;

  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverScript = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverScript)) {
    const msg =
      "The Next.js server bundle was not found.\n\n" +
      "If you are a developer, run:\n  npm run build\n\nThen relaunch the app.";
    dialog.showErrorBox("BuildVerse – Startup Error", msg);
    app.quit();
    return;
  }

  const nodeExe = findNodeExecutable();
  if (!nodeExe) {
    dialog.showErrorBox(
      "BuildVerse – Node.js Not Found",
      "BuildVerse requires Node.js to run its local server.\n\n" +
      "Please install Node.js from https://nodejs.org and restart the app."
    );
    app.quit();
    return;
  }
  console.log(`[buildverse] Using Node.js at: ${nodeExe}`);

  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: loadPrefs().lanAccess ? "0.0.0.0" : "127.0.0.1",
    NODE_ENV: "production",
    // BV_DATABASE_URL takes priority over the relative DATABASE_URL baked into
    // the standalone .env — always an absolute path so it resolves correctly.
    BV_DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
    DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
    BUILDVERSE_DATA_DIR: app.getPath("userData"),
  };

  serverProcess = spawn(nodeExe, [serverScript], {
    cwd: standaloneDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Attach error handlers to prevent broken pipe crashes
  serverProcess.stdout.on("error", (err) => {
    if (err.code !== "EPIPE") console.error("[next:stdout]", err.message);
  });
  serverProcess.stderr.on("error", (err) => {
    if (err.code !== "EPIPE") console.error("[next:stderr]", err.message);
  });

  serverProcess.stdout.on("data", (d) => {
    try { console.log(`[next] ${d.toString().trimEnd()}`); } catch {}
  });
  serverProcess.stderr.on("data", (d) => {
    try { console.error(`[next] ${d.toString().trimEnd()}`); } catch {}
  });

  serverProcess.on("error", (err) => {
    console.error("[buildverse] Failed to start server process:", err.message);
  });

  serverProcess.on("exit", (code) => {
    if (!app.isQuitting) {
      console.error(`[buildverse] Server exited with code ${code}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.loadURL(
          `data:text/html,<h2 style="font-family:sans-serif;color:#f97316;padding:2rem">
            BuildVerse server stopped unexpectedly (exit&nbsp;${code}).
            <br><br>Please restart the app.
          </h2>`
        );
      }
    }
  });

  console.log(`[buildverse] Waiting for server on port ${PORT}…`);
  await waitForServer(`http://127.0.0.1:${PORT}`);
  console.log("[buildverse] Server is ready");
}

// ──────────────────────────────────────────────────────────
// Browser window
// ──────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#090d14",
    title: APP_NAME,
    icon: loadIcon(),
    autoHideMenuBar: true,
    titleBarStyle: "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      const mode = getCloseMode();
      if (mode === "background") {
        e.preventDefault();
        mainWindow.hide();
        tray?.displayBalloon?.({
          iconType: "info",
          title: APP_NAME,
          content: "BuildVerse is running in the system tray.",
        });
      } else {
        app.isQuitting = true;
        // server and tray cleaned up in before-quit
      }
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ──────────────────────────────────────────────────────────
// System tray
// ──────────────────────────────────────────────────────────

function createTray() {
  const icon = loadIcon(16);
  if (icon.isEmpty()) return;

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open BuildVerse",
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        else createWindow();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    else createWindow();
  });
}

// ──────────────────────────────────────────────────────────
// IPC – expose useful info to the renderer
// ──────────────────────────────────────────────────────────

ipcMain.handle("get-app-info", () => ({
  version: app.getVersion(),
  userDataPath: app.getPath("userData"),
  dbPath: path.join(app.getPath("userData"), "buildverse.db"),
  isDev: IS_DEV,
}));

// ──────────────────────────────────────────────────────────
// App lifecycle
// ──────────────────────────────────────────────────────────

// ── Close-behaviour preference ────────────────────────────────────────────────
// Stored in userData/prefs.json  { "closeMode": "background" | "quit" }

function getPrefsPath() {
  return path.join(app.getPath("userData"), "prefs.json");
}

function loadPrefs() {
  try { return JSON.parse(fs.readFileSync(getPrefsPath(), "utf8")); } catch { return {}; }
}

function savePrefs(obj) {
  const existing = loadPrefs();
  fs.writeFileSync(getPrefsPath(), JSON.stringify({ ...existing, ...obj }, null, 2));
}

function getCloseMode() {
  return loadPrefs().closeMode ?? "quit";
}

ipcMain.handle("prefs:get", () => loadPrefs());
ipcMain.handle("prefs:set", (_, obj) => { savePrefs(obj); return { success: true }; });

// ── Single-instance lock — prevents a second copy from launching ──────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    const dbPath = ensureDatabase();
    autoBackupOnStartup(dbPath);
    await startServer(dbPath);
    createWindow();
    createTray();
    initAutoUpdater();
  } catch (err) {
    console.error("[buildverse] Fatal startup error:", err);
    dialog.showErrorBox(
      "BuildVerse – Fatal Error",
      `Failed to start:\n\n${err.message}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

