/**
 * electron-builder afterPack hook — runs after the app is assembled, before the .dmg/.zip/installer is made.
 *
 * macOS: with no Apple Developer certificate, electron-builder (identity: null) leaves the app UNSIGNED.
 * Electron ships ad-hoc signed, but adding our resources invalidates that signature, and on Apple Silicon a
 * broken signature makes Gatekeeper report "<app> is damaged and can't be opened" — worse than the normal
 * "unidentified developer" prompt. Re-signing ad-hoc ("-") restores a valid (if untrusted) signature, so the
 * first launch is the usual "Open Anyway" flow instead.
 *
 * Skipped when a real certificate is configured (CSC_LINK) so proper signing/notarization isn't interfered with.
 */
"use strict";

const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.CSC_LINK) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`[after-pack] ad-hoc signing ${appPath}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
  console.log("[after-pack] signature verified");
};
