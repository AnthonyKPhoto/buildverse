/**
 * Generates every logo/icon asset from ONE source: public/logo.svg
 *
 *   npm run gen-icons
 *
 * Needs only @resvg/resvg-js (already a devDependency) — no sharp / png-to-ico.
 * Outputs are committed, so CI and contributors don't have to run this:
 *
 *   build/icon.ico            Windows exe / installer / taskbar (16–256 px, PNG-in-ICO)
 *   build/icon.png            512×512 — Linux package + the desktop app's window/tray icon
 *   build/icon-mac.png        1024×1024 with macOS-style padding — electron-builder → .icns
 *   public/favicon.ico        browser tab (16/32/48)
 *   public/icon-32|192|512.png
 *   public/apple-touch-icon.png   180×180, square (iOS rounds it itself)
 *   src/lib/logo-data.ts      small inline PNG for the PDF export (no network fetch)
 *   capacitor-app/logo.svg    for the Android web app screens
 *   android/…/mipmap-<dpi>      launcher icons (square, round, adaptive foreground)
 *   android/…/drawable-(port|land)-<dpi>/splash.png
 *
 * The source SVG is a 512×512 rounded-square icon whose artwork sits on a dark
 * background. Variants below are made by transforming that same SVG text, so the
 * artwork is only ever drawn once.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "public", "logo.svg"), "utf8");
const BG = "#090c14"; // matches the icon's dark end-of-gradient; used for splash/adaptive backgrounds

// ── SVG variants ────────────────────────────────────────────────────────────────
const BG_RECT = /<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/;
if (!BG_RECT.test(SRC)) throw new Error("public/logo.svg no longer has the expected background <rect> — update scripts/gen-icons.js");

const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const wrap = (body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${extra}>${body}</svg>`;

const full = SRC;                                                   // rounded square
const square = SRC.replace('rx="112"', 'rx="0"');                  // full-bleed (iOS)
const round = SRC.replace('rx="112"', 'rx="256"');                  // circle (Android round)
const markOnly = SRC.replace(BG_RECT, "");                          // transparent, artwork only

// The artwork's visual centre is (256, 260); scale about it, keeping inside a safe zone.
const scaled = (svg, s) => {
  const body = inner(svg);
  return wrap(`<g transform="translate(256 256) scale(${s}) translate(-256 -260)">${body}</g>`);
};

// Adaptive icon foreground: Android masks the outer ~1/3, so keep the mark in the middle.
const adaptiveForeground = scaled(markOnly, 0.92);

// macOS icons are drawn inside a 1024 canvas with ~10% margin on every side.
const macIcon = (() => {
  const body = inner(full);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(102 102) scale(1.6094)">${body}</g></svg>`;
})();

function splash(w, h) {
  const s = Math.round(Math.min(w, h) * 0.42);
  const body = inner(markOnly);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${BG}"/>` +
    `<svg x="${Math.round((w - s) / 2)}" y="${Math.round((h - s) / 2)}" width="${s}" height="${s}" viewBox="0 0 512 512">${body}</svg></svg>`;
}

// ── Rendering ─────────────────────────────────────────────────────────────────────
function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

/** PNG-in-ICO: ICONDIR + one ICONDIRENTRY per image, followed by the raw PNG streams. */
function ico(images /* [{size, data}] */) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...images.map((i) => i.data)]);
}

const out = (rel, data) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log("✓", rel);
};

// Desktop
out("build/icon.ico", ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: png(full, size) }))));
out("build/icon.png", png(full, 512));
out("build/icon-mac.png", png(macIcon, 1024));

// Web
out("public/favicon.ico", ico([16, 32, 48].map((size) => ({ size, data: png(full, size) }))));
out("public/icon-32.png", png(full, 32));
out("public/icon-192.png", png(full, 192));
out("public/icon-512.png", png(full, 512));
out("public/apple-touch-icon.png", png(square, 180));

// PDF export — a small PNG inlined as a data URI so rendering never depends on a network fetch
const b64 = png(full, 96).toString("base64");
out("src/lib/logo-data.ts",
  `// GENERATED by scripts/gen-icons.js from public/logo.svg — do not edit.\nexport const LOGO_PNG_DATA_URI = "data:image/png;base64,${b64}";\n`);

// Android web app
out("capacitor-app/logo.svg", SRC);

// Android launcher icons
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  const dir = `android/app/src/main/res/mipmap-${d}`;
  out(`${dir}/ic_launcher.png`, png(full, Math.round(48 * k)));
  out(`${dir}/ic_launcher_round.png`, png(round, Math.round(48 * k)));
  out(`${dir}/ic_launcher_foreground.png`, png(adaptiveForeground, Math.round(108 * k)));
}
out("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_foreground.png", png(adaptiveForeground, 432));
out("android/app/src/main/res/values/ic_launcher_background.xml",
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);

// Android splash screens — keep each file's existing pixel size
const SPLASH = [
  ["drawable", 512, 512],
  ["drawable-land-mdpi", 480, 320], ["drawable-land-hdpi", 800, 480], ["drawable-land-xhdpi", 1280, 720],
  ["drawable-land-xxhdpi", 1600, 960], ["drawable-land-xxxhdpi", 1920, 1280],
  ["drawable-port-mdpi", 320, 480], ["drawable-port-hdpi", 480, 800], ["drawable-port-xhdpi", 720, 1280],
  ["drawable-port-xxhdpi", 960, 1600], ["drawable-port-xxxhdpi", 1280, 1920],
];
for (const [dir, w, h] of SPLASH) {
  const file = path.join(ROOT, "android/app/src/main/res", dir, "splash.png");
  if (!fs.existsSync(file) && dir !== "drawable") continue; // only replace splashes that already exist
  out(`android/app/src/main/res/${dir}/splash.png`, png(splash(w, h), w));
}
console.log("\nDone. Commit the generated files.");
