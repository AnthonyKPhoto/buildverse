// Matching mods to tracked products. A mod's `link` and a tracked product's
// `url` are usually the same page but rarely byte-identical (trailing slash,
// #fragment, utm_* tracking params, upper-case host…), so compare normalized.

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|msclkid$|mc_|ref$|ref_$|cmpid$|affid$|irclickid$)/i;

export function normalizeProductUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const k of Array.from(u.searchParams.keys())) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    let out = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
    if (out.endsWith("?")) out = out.slice(0, -1);
    return out;
  } catch {
    return raw.trim();
  }
}

/** Mods in these states are finished business — their product link shouldn't be price-watched any more. */
export const DONE_STATUSES = ["PURCHASED", "INSTALLED", "REMOVED"] as const;
export function isDoneStatus(status: string | null | undefined): boolean {
  return !!status && (DONE_STATUSES as readonly string[]).includes(status);
}
