"use strict";

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
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

// Allow closing from tray menu without the close-to-tray behaviour
app.isQuitting = false;

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Polls url until a non-5xx response is returned (or timeout). */
function waitForServer(url, maxMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode < 500) return resolve();
        schedule();
      });
      req.on("error", schedule);
      req.setTimeout(1500, () => { req.destroy(); schedule(); });
    }
    function schedule() {
      if (Date.now() - start > maxMs) return reject(new Error("Server startup timed out"));
      setTimeout(attempt, 600);
    }
    attempt();
  });
}

/** Returns the path to the icon file (dev or packaged). */
function iconPath() {
  return IS_DEV
    ? path.join(__dirname, "..", "public", "icon.png")
    : path.join(process.resourcesPath, "icon.png");
}

/** Returns a NativeImage for the tray/window icon (or empty if missing). */
function loadIcon(size) {
  const p = iconPath();
  if (!fs.existsSync(p)) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(p);
  return size ? img.resize({ width: size, height: size }) : img;
}

// ──────────────────────────────────────────────────────────
// Database bootstrap
// ──────────────────────────────────────────────────────────

/**
 * On first launch, copies the bundled seed database to the userData folder
 * so the user starts with demo data and has a writable location.
 * Returns the absolute path to the working database file.
 */
function ensureDatabase() {
  const userDataDir = app.getPath("userData");
  const dbDest = path.join(userDataDir, "buildverse.db");

  if (!fs.existsSync(dbDest)) {
    const template = IS_DEV
      ? path.join(__dirname, "..", "prisma", "dev.db")
      : path.join(process.resourcesPath, "prisma", "dev.db");

    if (fs.existsSync(template)) {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.copyFileSync(template, dbDest);
      console.log(`[buildverse] Initialised database at ${dbDest}`);
    } else {
      console.warn("[buildverse] No database template found; starting with empty DB");
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

/** Creates one auto-backup per day on startup, keeps last 10. */
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

  // Prune: keep last 10
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
  // Canonicalize BOTH paths before comparison.
  // Without path.resolve(), a path like "backups\..\buildverse.db" passes
  // the startsWith check but actually targets the parent directory.
  const safeFile = path.resolve(rawPath);
  const safeBase = path.resolve(getBackupsDir());
  if (!safeFile.startsWith(safeBase + path.sep)) throw new Error("Invalid path");
  if (!fs.existsSync(safeFile)) throw new Error("Backup file not found");

  const dbPath = path.join(app.getPath("userData"), "buildverse.db");

  // Kill the server so SQLite releases the file lock
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
  // Same canonicalization fix as backup:restore
  const safeFile = path.resolve(rawPath);
  const safeBase = path.resolve(getBackupsDir());
  if (!safeFile.startsWith(safeBase + path.sep)) throw new Error("Invalid path");
  fs.unlinkSync(safeFile);
  return { success: true };
});

// ──────────────────────────────────────────────────────────
// Auto-updater
// ──────────────────────────────────────────────────────────

function sendUpdateStatus(status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", { status, ...extra });
  }
}

function initAutoUpdater() {
  if (IS_DEV) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", (info) => sendUpdateStatus("available", { version: info.version }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus("current"));
  autoUpdater.on("error", () => sendUpdateStatus("error"));
  autoUpdater.on("download-progress", (p) => sendUpdateStatus("downloading", { percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus("downloaded", { version: info.version }));

  // Check 5 seconds after launch so startup is not blocked
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
}

ipcMain.handle("update:check", () => {
  if (IS_DEV) return;
  return autoUpdater.checkForUpdates().catch(() => {});
});

ipcMain.handle("update:install", () => {
  if (IS_DEV) return;
  autoUpdater.quitAndInstall(false, true);
});

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
    dialog.showErrorBox("BuildVerse — Startup Error", msg);
    app.quit();
    return;
  }

  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    DATABASE_URL: `file:${dbPath}`,
  };

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => console.log(`[next] ${d.toString().trimEnd()}`));
  serverProcess.stderr.on("data", (d) => console.error(`[next] ${d.toString().trimEnd()}`));

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
      e.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          iconType: "info",
          title: APP_NAME,
          content: "BuildVerse is still running in the system tray.",
        });
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
// IPC — expose useful info to the renderer
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
      "BuildVerse — Fatal Error",
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
