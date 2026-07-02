/**
 * Generates all BuildVerse icon assets from a source image.
 * Source priority: public/logo.png (preferred) → public/logo.svg
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
const pngToIcoMod = require("png-to-ico");
const pngToIco = pngToIcoMod.default ?? pngToIcoMod;

const ROOT      = path.join(__dirname, "..");
const pngSource = path.join(ROOT, "public", "logo.png");
const svgSource = path.join(ROOT, "public", "logo.svg");

fs.mkdirSync(path.join(ROOT, "build"),  { recursive: true });
fs.mkdirSync(path.join(ROOT, "public"), { recursive: true });

async function renderPng(size) {
  if (fs.existsSync(pngSource)) {
    const sharp = require("sharp");
    return sharp(pngSource)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }
  // Fallback: SVG via resvg
  const { Resvg } = require("@resvg/resvg-js");
  const svgData = fs.readFileSync(svgSource);
  const resvg = new Resvg(svgData, {
    fitTo: { mode: "width", value: size },
    font:  { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

async function main() {
  const usePng = fs.existsSync(pngSource);
  const useSvg = !usePng && fs.existsSync(svgSource);
  if (!usePng && !useSvg) {
    console.error("ERROR: No source image found. Place your logo at:");
    console.error("  public/logo.png  (recommended — use your icon PNG)");
    console.error("  public/logo.svg  (alternative)");
    process.exit(1);
  }
  console.log(`Source: ${usePng ? "public/logo.png" : "public/logo.svg"}`);
  console.log("Rendering icon sizes…");

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const allSizes = [...new Set([...icoSizes, 192, 512])];

  const pngBuffers = {};
  for (const s of allSizes) {
    console.log(`  ${s}×${s}`);
    pngBuffers[s] = await renderPng(s);
  }

  const ico = await pngToIco(icoSizes.map(s => pngBuffers[s]));
  fs.writeFileSync(path.join(ROOT, "build",  "icon.ico"), ico);
  console.log("✓ build/icon.ico");

  fs.writeFileSync(path.join(ROOT, "build",  "icon.png"), pngBuffers[512]);
  console.log("✓ build/icon.png");

  fs.writeFileSync(path.join(ROOT, "public", "icon-32.png"),  pngBuffers[32]);
  fs.writeFileSync(path.join(ROOT, "public", "icon-192.png"), pngBuffers[192]);
  fs.writeFileSync(path.join(ROOT, "public", "icon-512.png"), pngBuffers[512]);

  const favicon = await pngToIco([pngBuffers[16], pngBuffers[32]]);
  fs.writeFileSync(path.join(ROOT, "public", "favicon.ico"), favicon);
  console.log("✓ public/favicon.ico + icon PNGs");

  console.log("\nAll icons generated ✓");
}

main().catch(e => { console.error(e); process.exit(1); });
