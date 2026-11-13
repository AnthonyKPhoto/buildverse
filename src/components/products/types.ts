import { isOutOfStockText } from "@/lib/stock";

export interface PriceHistory { id: string; price: number; createdAt: string }

export interface TrackedProduct {
  id: string; url: string; title: string; brand?: string | null; imageUrl?: string | null;
  description?: string | null; currentPrice?: number | null; lowestPrice?: number | null;
  highestPrice?: number | null; previousPrice?: number | null; alertThreshold?: number | null;
  notifyEmail?: boolean; notifyRestock?: boolean; compareGroup?: string | null;
  lastNotifiedAt?: string | null; lastError?: string | null;
  vendor?: string | null; availability?: string | null; sku?: string | null;
  lastChecked?: string | null; createdAt: string; priceHistory: PriceHistory[];
}

export interface AlertSettingsLite {
  emailEnabled: boolean; autoCheck: boolean; intervalHours: number;
  smtpConfigured: boolean; effectiveRecipientCount: number; canEdit: boolean;
}

export const isAlertHit = (p: TrackedProduct) =>
  p.alertThreshold != null && p.currentPrice != null && p.currentPrice <= p.alertThreshold;

export const isDropped = (p: TrackedProduct) =>
  p.previousPrice != null && p.currentPrice != null && p.currentPrice < p.previousPrice - 0.004;

export const isOutOfStock = (p: TrackedProduct) => isOutOfStockText(p.availability);

/** A mod (on some vehicle) whose link points at a tracked product. */
export interface LinkedMod {
  modId: string; modName: string; status: string; price: number | null;
  vehicleId: string; vehicleName: string;
}

/** How one product compares with the rest of its comparison group. */
export interface GroupInfo {
  group: string;
  size: number;
  isBest: boolean;
  /** Extra cost versus the cheapest available option (0 when it is the cheapest). */
  extra: number;
  bestVendor: string | null;
  bestPrice: number | null;
}

/**
 * Groups products by `compareGroup`. The "best" option is the cheapest one that's
 * actually buyable — in stock (or stock unknown) with a known price. If nothing in
 * the group is buyable, falls back to the cheapest overall so the table still ranks.
 */
export function buildGroups(products: TrackedProduct[]): Map<string, TrackedProduct[]> {
  const m = new Map<string, TrackedProduct[]>();
  for (const p of products) {
    const g = p.compareGroup?.trim();
    if (!g) continue;
    const key = g.toLowerCase();
    m.set(key, [...(m.get(key) ?? []), p]);
  }
  return m;
}

export function rankGroup(members: TrackedProduct[]): TrackedProduct[] {
  const priced = members.filter((p) => p.currentPrice != null);
  const buyable = priced.filter((p) => !isOutOfStock(p));
  const rank = (a: TrackedProduct, b: TrackedProduct) => (a.currentPrice as number) - (b.currentPrice as number);
  return [...buyable.sort(rank), ...priced.filter((p) => isOutOfStock(p)).sort(rank), ...members.filter((p) => p.currentPrice == null)];
}

export function groupInfoFor(p: TrackedProduct, groups: Map<string, TrackedProduct[]>): GroupInfo | null {
  const g = p.compareGroup?.trim();
  if (!g) return null;
  const members = groups.get(g.toLowerCase()) ?? [p];
  const ranked = rankGroup(members);
  const best = ranked[0];
  const bestPrice = best?.currentPrice ?? null;
  return {
    group: g,
    size: members.length,
    isBest: members.length > 1 && best?.id === p.id && !isOutOfStock(p),
    extra: p.currentPrice != null && bestPrice != null ? Math.max(0, p.currentPrice - bestPrice) : 0,
    bestVendor: best?.vendor ?? null,
    bestPrice,
  };
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
