export interface PriceHistory { id: string; price: number; createdAt: string }

export interface TrackedProduct {
  id: string; url: string; title: string; brand?: string | null; imageUrl?: string | null;
  description?: string | null; currentPrice?: number | null; lowestPrice?: number | null;
  highestPrice?: number | null; previousPrice?: number | null; alertThreshold?: number | null;
  notifyEmail?: boolean; lastNotifiedAt?: string | null; lastError?: string | null;
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

export const isOutOfStock = (p: TrackedProduct) =>
  !!p.availability && /out of stock|sold out|unavailable|discontinued|backorder/i.test(p.availability);

export function timeAgo(iso?: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
