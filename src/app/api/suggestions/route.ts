import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/suggestions
 * Returns autocomplete suggestions for mod fields sourced from:
 *  - The user's existing modifications (brands, vendors, mod names)
 *  - A curated static list of well-known brands and vendors
 */
export async function GET() {
  try {
    // Pull distinct values the user has already entered
    const mods = await prisma.modification.findMany({
      select: { name: true, brand: true, vendor: true },
    });

    const userBrands  = dedupe(mods.map((m) => m.brand).filter((x): x is string => !!x));
    const userVendors = dedupe(mods.map((m) => m.vendor).filter((x): x is string => !!x));
    const userNames   = dedupe(mods.map((m) => m.name).filter((x): x is string => !!x));

    return NextResponse.json({
      brands:  dedupe([...userBrands,  ...STATIC_BRANDS]),
      vendors: dedupe([...userVendors, ...STATIC_VENDORS]),
      names:   dedupe(userNames),
    });
  } catch {
    return NextResponse.json({ brands: STATIC_BRANDS, vendors: STATIC_VENDORS, names: [] });
  }
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = s.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(s); }
  }
  return out;
}

// ── Static brand catalogue ─────────────────────────────────────────────────────
const STATIC_BRANDS = [
  // Suspension
  "BC Racing","Bilstein","KW Suspension","Öhlins","Tein","HKS","Coilover","H&R","Eibach",
  "Fortune Auto","MCS","Penske Racing Shocks","Öhlins TTX","AST","JRZ",
  "Whiteline","Hotchkis","Ground Control","Stance","ST Suspensions",
  // Brakes
  "Brembo","StopTech","EBC Brakes","Hawk Performance","PowerStop","Wilwood","AP Racing",
  "Project Mu","Endless","Spoon Sports","PFC","Carbotech","DBA",
  // Exhaust
  "Borla","MagnaFlow","Akrapovič","Remus","Milltek","Invidia","HKS","GReddy","Tomei",
  "Buddy Club","Skunk2","Tanabe","Fujitsubo","APEXi","Corsa","Flowmaster",
  // Intake / Engine
  "K&N","AEM","Mishimoto","Perrin","Grimmspeed","Cobb","APR","Unitronic","034Motorsport",
  "CTS Turbo","Integrated Engineering","Sneak-R","AFe","BMS","Eventuri","MST",
  // Turbo / Forced Induction
  "Garrett","BorgWarner","Precision Turbo","Tial","Turbosmart","Forge Motorsport","Synapse",
  "GFB","Recirculation","Comp Turbo","MHI","ATP Turbo",
  // Wheels
  "Enkei","Volk Racing / TE37","Work Wheels","BBS","OZ Racing","HRE","Advan",
  "Gram Lights","SSR","Weds","Konig","Kosei","Apex",
  "Rotiform","Vossen","Forgeline","Brixton","Fuel",
  // Electronics / Tuning
  "Cobb","MoTeC","Haltech","Ecumaster","LINK ECU","AEM EMS","SCT","HP Tuners",
  "EFI Live","DiabloSport",
  // Interior
  "Recaro","Sparco","Bride","Momo","NRG","OMP","Takata","Willans","Schroth",
  "Racetech","Sabelt",
  // Tyres
  "Michelin","Bridgestone","Toyo","Falken","Yokohama","Continental","Pirelli",
  "Nitto","BFGoodrich","Hoosier","Mickey Thompson","Hankook","Nexen",
  // Aero
  "Seibon","Anderson Composites","APR Performance","Voltex","Carbon Signal",
  "Aerocatch","Varis",
  // Drivetrain
  "OS Giken","Cusco","Quaife","Kaaz","Nismo","Tomei","ACT","Exedy","South Bend",
  "Clutchmasters","McLeod","Tilton",
  // Cooling
  "Koyo","Mishimoto","CSF","Setrab","Earls","Fluidyne",
  // Other
  "Moroso","Canton","IAG","KPower","Radium","Radix","Vibrant","Sikky","Dirty Hooker Diesel",
];

// ── Static vendor catalogue (mirrors vendors page) ─────────────────────────────
const STATIC_VENDORS = [
  // Universal
  "Tire Rack","RockAuto","Summit Racing","JEGS","Amazon","eBay","AutoZone","O'Reilly Auto Parts","Advance Auto Parts",
  // German / Euro
  "ECS Tuning","FCP Euro","BavAuto","Turner Motorsport","eEuroparts","Pelican Parts",
  "PartsGeek","AutohausAZ","IE","034Motorsport","AWE Tuning","APR","Unitronic","BMP Tuning","UROTuning",
  // JDM / Japanese
  "Z1 Motorsports","JWT","Motive","JDMyard","Amayama","RockAuto","SoCal Garage","Enjuku Racing",
  "Vivid Racing","Concept Z Performance","Mine's","TopSecret","HKS USA",
  // Subaru
  "COBB Tuning","Grimmspeed","Perrin Performance","IAG Performance","Primitive Racing","Subispeed",
  // American Muscle / Domestic
  "American Muscle","LMR","CJ Pony Parts","Eckler's","West Coast Corvette","RPM Outlet",
  // Suspension specialists
  "KW Suspension","H&R Springs","Whiteline","Ground Control","Fortune Auto",
  // Turbo / engine
  "Turbosmart","Tial Sport","CTS Turbo","ATP Turbo","Vibrant Performance","Radium Engineering",
  // Brake specialists
  "Stoptech","EBC Brakes","Wilwood Engineering","AP Racing","Brembo North America",
  // Audio / Electronics
  "Crutchfield","Best Buy","Sound Ordnance","Sonic Electronix",
  // Truck / Off-Road
  "4 Wheel Parts","OReillyAuto","Quadratec","Rugged Ridge","TeraFlex","Fox Factory",
  // Other
  "Special Order","Direct from Manufacturer","Local Shop","Private Seller",
];
