/**
 * Generates all BuildVerse icon assets from public/logo.svg
 *
 * Outputs:
 *   build/icon.ico        — Windows exe / installer / taskbar (16–256 px)
 *   build/icon.png        — 512×512 PNG (electron-builder fallback)
 *   public/favicon.ico    — Browser favicon
 *   public/icon-32.png    — Small PNG for browser tab
 *   public/icon-192.png   — PWA / OG
 *   public/icon-512.png   — Full-size
 */

const fs   = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const pngToIcoMod = require("png-to-ico");
const pngToIco = pngToIcoMod.default ?? pngToIcoMod;

const ROOT   = path.join(__dirname, "..");
const svgSrc = fs.readFileSync(path.join(ROOT, "public", "logo.svg"));

fs.mkdirSync(path.join(ROOT, "build"),  { recursive: true });
fs.mkdirSync(path.join(ROOT, "public"), { recursive: true });

/** Render SVG → PNG Buffer at a given pixel size */
function renderPng(size) {
  const resvg = new Resvg(svgSrc, {
    fitTo: { mode: "width", value: size },
    font:  { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

async function main() {
  console.log("Rendering icon sizes…");

  // Sizes needed for the ICO (Windows multi-size icon)
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];

  // Render all sizes
  const pngBuffers = {};
  for (const s of [...new Set([...icoSizes, 192, 512])]) {
    console.log(`  ${s}×${s}`);
    pngBuffers[s] = renderPng(s);
  }

  // ── ICO (build/icon.ico) ────────────────────────────────────────────────
  const ico = await pngToIco(icoSizes.map(s => pngBuffers[s]));
  fs.writeFileSync(path.join(ROOT, "build",  "icon.ico"), ico);
  console.log("✓ build/icon.ico");

  // ── 512×512 PNG (build/icon.png) ────────────────────────────────────────
  fs.writeFileSync(path.join(ROOT, "build",  "icon.png"), pngBuffers[512]);
  console.log("✓ build/icon.png");

  // ── Public assets ────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(ROOT, "public", "icon-32.png"),  pngBuffers[32]);
  fs.writeFileSync(path.join(ROOT, "public", "icon-192.png"), pngBuffers[192]);
  fs.writeFileSync(path.join(ROOT, "public", "icon-512.png"), pngBuffers[512]);

  // Favicon ICO (16 + 32)
  const favicon = await pngToIco([pngBuffers[16], pngBuffers[32]]);
  fs.writeFileSync(path.join(ROOT, "public", "favicon.ico"), favicon);
  console.log("✓ public/favicon.ico + icon PNGs");

  console.log("\nAll icons generated ✓");
}

main().catch(e => { console.error(e); process.exit(1); });
