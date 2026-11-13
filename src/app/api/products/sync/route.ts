import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { trackUrl, pruneBoughtProducts, getPriceAlertSettings } from "@/lib/price-tracker";
import { normalizeProductUrl, DONE_STATUSES } from "@/lib/product-links";

export const maxDuration = 300;

export const dynamic = "force-dynamic";

/** GET → cars with how many of their mod links could be tracked (for the "Sync from Mods" picker). */
export async function GET() {
  const [vehicles, mods] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, name: true, year: true, make: true, model: true }, orderBy: { createdAt: "asc" } }),
    prisma.modification.findMany({ where: { link: { not: null } }, select: { vehicleId: true, status: true, link: true } }),
  ]);
  const tracked = new Set((await prisma.trackedProduct.findMany({ select: { url: true } })).map((p) => normalizeProductUrl(p.url)));
  return NextResponse.json(vehicles.map((v) => {
    const mine = mods.filter((m) => m.vehicleId === v.id && m.link && /^https?:\/\//i.test(m.link));
    const open = mine.filter((m) => !(DONE_STATUSES as readonly string[]).includes(m.status));
    return {
      id: v.id,
      name: v.name || `${v.year} ${v.make} ${v.model}`,
      links: open.length,
      untracked: open.filter((m) => !tracked.has(normalizeProductUrl(m.link))).length,
      done: mine.length - open.length,
    };
  }));
}

const bodySchema = z.object({ vehicleIds: z.array(z.string().max(64)).max(200).optional() });

/**
 * POST /api/products/sync   body: { vehicleIds?: string[] }
 * Tracks the product links of modifications that aren't tracked yet — for the
 * chosen cars only (all cars if omitted). Mods already Purchased / Installed /
 * Removed are ignored: there's nothing left to price-watch.
 * Returns { added, skipped, failed, ignored, removed }.
 */
export async function POST(req: NextRequest) {
  try {
    const { vehicleIds } = bodySchema.parse(await req.json().catch(() => ({})));

    const mods = await prisma.modification.findMany({
      where: { link: { not: null }, ...(vehicleIds ? { vehicleId: { in: vehicleIds } } : {}) },
      select: { link: true, status: true },
    });

    const seen = new Set<string>();
    const urls: string[] = [];
    let ignored = 0;
    for (const m of mods) {
      const u = m.link!;
      if (!/^https?:\/\//i.test(u)) continue;
      if ((DONE_STATUSES as readonly string[]).includes(m.status)) { ignored++; continue; }
      const n = normalizeProductUrl(u);
      if (seen.has(n)) continue;
      seen.add(n);
      urls.push(u);
    }

    let added = 0, failed = 0, skipped = 0;
    for (const url of urls) {
      try {
        // trackUrl() skips anything already tracked (normalized-URL match)
        const { created } = await trackUrl(url);
        if (created) added++; else skipped++;
      } catch {
        failed++;
      }
    }

    const removed = (await getPriceAlertSettings()).autoRemoveBought ? await pruneBoughtProducts().catch(() => 0) : 0;
    return NextResponse.json({ added, skipped, failed, ignored, removed });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
