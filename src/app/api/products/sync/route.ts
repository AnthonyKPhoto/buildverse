import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackUrl } from "@/lib/price-tracker";

/**
 * POST /api/products/sync
 * Finds all modification links in the DB and tracks any that aren't already
 * in the product tracker.  Returns { added, skipped, failed }.
 */
export async function POST() {
  try {
    // Gather every unique https link from modifications
    const mods = await prisma.modification.findMany({
      where: { link: { not: null } },
      select: { link: true },
    });

    const seen = new Set<string>();
    const urls: string[] = [];
    for (const m of mods) {
      const u = m.link!;
      if (/^https?:\/\//i.test(u) && !seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({ added: 0, skipped: 0, failed: 0 });
    }

    let added = 0;
    let failed = 0;
    let skipped = 0;

    for (const url of urls) {
      try {
        // trackUrl() skips anything already tracked (normalized-URL match)
        const { created } = await trackUrl(url);
        if (created) added++; else skipped++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ added, skipped, failed });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
