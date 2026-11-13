// Shared by the server (restock alerts) and the UI (badges, filters).

/** True when the shop's availability text says it can't be bought right now. */
export function isOutOfStockText(availability?: string | null): boolean {
  return !!availability && /out of stock|sold out|unavailable|discontinued|backorder/i.test(availability);
}

/** "in" / "out", or null when the shop doesn't say. */
export function stockState(availability?: string | null): "in" | "out" | null {
  if (!availability || !availability.trim()) return null;
  return isOutOfStockText(availability) ? "out" : "in";
}
