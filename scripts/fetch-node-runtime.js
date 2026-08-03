/**
 * fetch-node-runtime.js
 *
 * Downloads the official Node.js binary for the current platform (matching
 * the exact version this script is running under) and drops it at
 * resources-extra/node(.exe) — from there electron-builder.yml's win/linux
 * extraResources bundle it into the packaged app's resources/ directory.
 * electron/main.js's findNodeExecutable() looks there first at runtime.
 *
 * Without this, the packaged app depends on the end user already having
 * Node.js installed and on PATH — this is what makes "no prerequisites"
 * actually true instead of just claimed.
 *
 * Run by: npm run electron:build / electron:build:linux (and the CI release
 * jobs), before electron-builder packages the app. Idempotent — skips the
 * download if the binary is already present.
 */
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const AdmZip = require("adm-zip");

const OUT_DIR = path.join(__dirname, "..", "resources-extra");
const VERSION = process.version; // e.g. "v22.11.0" — bundle exactly what built/tested the app

// The bundled runtime becomes the packaged app's server-side Node — it must
// meet the same floor as everywhere else in this repo (undici@8.9.0, used by
// src/lib/scraper.ts, requires Node >=22.19.0; see Dockerfile). CI always
// builds on the pinned Node 22 from setup-node, so this only matters for
// local `npm run package:win`/`package:linux` builds on an older Node.
const MIN_VERSION = [22, 19, 0];
{
  const current = VERSION.replace(/^v/, "").split(".").map(Number);
  let tooOld = false;
  for (let i = 0; i < MIN_VERSION.length; i++) {
    if (current[i] > MIN_VERSION[i]) break; // newer — satisfied
    if (current[i] < MIN_VERSION[i]) { tooOld = true; break; } // older — fails
    // equal so far — check the next, more specific part
  }
  if (tooOld) {
    console.error(
      `[fetch-node-runtime] Current Node ${VERSION} is older than the required ${MIN_VERSION.join(".")} — ` +
        `bundling it would ship a packaged app that crashes on startup (see src/lib/scraper.ts / undici). ` +
        `Upgrade your local Node.js before running this.`
    );
    process.exit(1);
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirectsLeft) => {
      https
        .get(u, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
            res.resume();
            return follow(res.headers.location, redirectsLeft - 1);
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode} ${u}`));
            return;
          }
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on("finish", () => file.close(resolve));
          file.on("error", reject);
        })
        .on("error", reject);
    };
    follow(url, 5);
  });
}

async function fetchWindows() {
  const dest = path.join(OUT_DIR, "node.exe");
  if (fs.existsSync(dest)) {
    console.log("[fetch-node-runtime] node.exe already present, skipping download");
    return;
  }
  const zipPath = path.join(OUT_DIR, "_node-win.zip");
  const url = `https://nodejs.org/dist/${VERSION}/node-${VERSION}-win-x64.zip`;
  console.log(`[fetch-node-runtime] Fetching ${url}`);
  await download(url, zipPath);
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntries().find((e) => e.entryName.endsWith("/node.exe"));
  if (!entry) throw new Error("node.exe not found inside the downloaded archive");
  fs.writeFileSync(dest, entry.getData());
  fs.unlinkSync(zipPath);
  console.log(`[fetch-node-runtime] Wrote ${dest} (${fs.statSync(dest).size} bytes)`);
}

async function fetchLinux() {
  const dest = path.join(OUT_DIR, "node");
  if (fs.existsSync(dest)) {
    console.log("[fetch-node-runtime] node already present, skipping download");
    return;
  }
  const tarPath = path.join(OUT_DIR, "_node-linux.tar.gz");
  const extractDir = path.join(OUT_DIR, "_node-linux-extract");
  const url = `https://nodejs.org/dist/${VERSION}/node-${VERSION}-linux-x64.tar.gz`;
  console.log(`[fetch-node-runtime] Fetching ${url}`);
  await download(url, tarPath);
  fs.mkdirSync(extractDir, { recursive: true });
  // System `tar` — present on every mainstream Linux distro/CI image; this
  // script is only ever run there or in CI, never on a bare-metal target
  // machine, so relying on it is safe (unlike the packaged app itself).
  execFileSync("tar", ["-xzf", tarPath, "-C", extractDir, "--strip-components=2", `node-${VERSION}-linux-x64/bin/node`]);
  fs.copyFileSync(path.join(extractDir, "node"), dest);
  fs.chmodSync(dest, 0o755);
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.unlinkSync(tarPath);
  console.log(`[fetch-node-runtime] Wrote ${dest} (${fs.statSync(dest).size} bytes)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (process.platform === "win32") {
    await fetchWindows();
  } else if (process.platform === "linux") {
    await fetchLinux();
  } else {
    console.log(`[fetch-node-runtime] Unsupported platform "${process.platform}" — skipping (no packaged build target for it)`);
  }
}

main().catch((err) => {
  console.error("[fetch-node-runtime] failed:", err.message || err);
  process.exit(1);
});
