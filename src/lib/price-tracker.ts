import { prisma } from "@/lib/prisma";
import { scrapeProduct } from "@/lib/scraper";
import { sendMail, isSmtpConfigured } from "@/lib/mailer";
import { stockState } from "@/lib/stock";
import { normalizeProductUrl, DONE_STATUSES } from "@/lib/product-links";

// Everything the Product Tracker does server-side: reading/saving the alert
// settings, refreshing a product's price, deciding whether an email is due, and
// the background check run by src/instrumentation.ts.

// ── Settings (stored in the generic Setting table) ───────────────────────────

const SETTINGS_KEY = "price_alerts";

export interface PriceAlertSettings {
  /** Master switch for emails. Off by default — nothing is ever sent unless the user turns it on. */
  emailEnabled: boolean;
  /** Who gets the emails. If empty, admins with an email address on file are used. */
  recipients: string[];
  /** Re-check products in the background, even when nobody has the app open. */
  autoCheck: boolean;
  /** How often each product is re-checked (hours). */
  intervalHours: number;
  /** Also email when a product drops by at least this % since its last check (0 = off). */
  dropPercent: number;
  /** Stop tracking a product once the mod it's linked to is Purchased / Installed / Removed. */
  autoRemoveBought: boolean;
}

export const DEFAULT_PRICE_ALERT_SETTINGS: PriceAlertSettings = {
  emailEnabled: false,
  recipients: [],
  autoCheck: true,
  intervalHours: 12,
  dropPercent: 0,
  autoRemoveBought: true,
};

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function sanitizeSettings(input: Partial<PriceAlertSettings>, base: PriceAlertSettings): PriceAlertSettings {
  const next = { ...base };
  if (typeof input.emailEnabled === "boolean") next.emailEnabled = input.emailEnabled;
  if (typeof input.autoCheck === "boolean") next.autoCheck = input.autoCheck;
  if (typeof input.autoRemoveBought === "boolean") next.autoRemoveBought = input.autoRemoveBought;
  if (Array.isArray(input.recipients)) {
    next.recipients = Array.from(new Set(
      input.recipients.map((r) => String(r).trim()).filter((r) => EMAIL_RE.test(r) && r.length <= 254)
    )).slice(0, 10);
  }
  if (typeof input.intervalHours === "number" && Number.isFinite(input.intervalHours)) {
    next.intervalHours = Math.min(168, Math.max(1, Math.round(input.intervalHours)));
  }
  if (typeof input.dropPercent === "number" && Number.isFinite(input.dropPercent)) {
    next.dropPercent = Math.min(90, Math.max(0, Math.round(input.dropPercent)));
  }
  return next;
}

export async function getPriceAlertSettings(): Promise<PriceAlertSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
  if (!row) return { ...DEFAULT_PRICE_ALERT_SETTINGS };
  try {
    return sanitizeSettings(JSON.parse(row.value), DEFAULT_PRICE_ALERT_SETTINGS);
  } catch {
    return { ...DEFAULT_PRICE_ALERT_SETTINGS };
  }
}

export async function savePriceAlertSettings(input: Partial<PriceAlertSettings>): Promise<PriceAlertSettings> {
  const next = sanitizeSettings(input, await getPriceAlertSettings());
  const value = JSON.stringify(next);
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value },
    create: { key: SETTINGS_KEY, value },
  });
  return next;
}

/** Recipients to actually use: the configured list, else admin accounts that have an email. */
export async function resolveRecipients(settings: PriceAlertSettings): Promise<string[]> {
  if (settings.recipients.length > 0) return settings.recipients;
  const admins = await prisma.user
    .findMany({ where: { role: "admin", email: { not: null } }, select: { email: true } })
    .catch(() => []);
  return admins.map((a) => a.email!).filter(Boolean);
}

// ── Refreshing one product ───────────────────────────────────────────────────

const PRODUCT_INCLUDE = { priceHistory: { orderBy: { createdAt: "desc" as const }, take: 60 } };
const DAY_MS = 24 * 60 * 60 * 1000;

function isPlaceholderTitle(t: string | null | undefined): boolean {
  return !t || t === "Unknown Product" || /^Product from /.test(t);
}

/**
 * Re-scrapes a product and updates it.
 *
 * Unlike the old inline logic this never destroys good data: a failed fetch,
 * or a page where no price could be read, only records `lastError` — the
 * previous price, title and image are kept. All-time low/high are only ever
 * widened, and a history point is only written when the price actually moved
 * (or once a day), so the chart isn't a flat line of duplicates.
 */
export async function refreshProduct(id: string) {
  const p = await prisma.trackedProduct.findUnique({ where: { id } });
  if (!p) return null;
  const now = new Date();

  let scraped;
  try {
    scraped = await scrapeProduct(p.url);
  } catch (err) {
    return prisma.trackedProduct.update({
      where: { id },
      data: { lastChecked: now, lastError: err instanceof Error ? err.message : "Check failed" },
      include: PRODUCT_INCLUDE,
    });
  }

  if (scraped.failed) {
    return prisma.trackedProduct.update({
      where: { id },
      data: { lastChecked: now, lastError: scraped.error ?? "Couldn't load the page" },
      include: PRODUCT_INCLUDE,
    });
  }

  const data: Record<string, unknown> = {
    lastChecked: now,
    lastError: null,
    title: isPlaceholderTitle(scraped.title) ? undefined : scraped.title,
    brand: scraped.brand || undefined,
    imageUrl: scraped.imageUrl || undefined,
    description: scraped.description || undefined,
    availability: scraped.availability || undefined,
    sku: scraped.sku || undefined,
  };

  const price = scraped.price;
  if (price == null) {
    data.lastError = "Couldn't read a price from this page";
  } else {
    const changed = p.currentPrice == null || Math.abs(p.currentPrice - price) > 0.004;
    data.currentPrice = price;
    if (changed && p.currentPrice != null) data.previousPrice = p.currentPrice;
    if (p.lowestPrice == null || price < p.lowestPrice) data.lowestPrice = price;
    if (p.highestPrice == null || price > p.highestPrice) data.highestPrice = price;

    const last = await prisma.priceHistory.findFirst({ where: { productId: id }, orderBy: { createdAt: "desc" } });
    if (changed || !last || now.getTime() - last.createdAt.getTime() > DAY_MS) {
      data.priceHistory = { create: { price } };
    }
  }

  return prisma.trackedProduct.update({ where: { id }, data, include: PRODUCT_INCLUDE });
}

// ── Alert evaluation ─────────────────────────────────────────────────────────

export interface AlertItem {
  id: string;
  title: string;
  url: string;
  vendor: string | null;
  price: number;
  previousPrice: number | null;
  threshold: number | null;
  reason: "threshold" | "drop" | "restock";
  /** A restock email that ALSO happens to be at/below the target price. */
  targetHit?: boolean;
}

type Tracked = NonNullable<Awaited<ReturnType<typeof refreshProduct>>>;

/**
 * Decides whether `after` (the product post-refresh) warrants an email.
 *
 * `before` is the state as of the last BACKGROUND check (not the last refresh of
 * any kind) — otherwise opening the page, which silently refreshes stale
 * products, would swallow a drop or restock before the background job saw it.
 *
 * Target price: emails once when the price first reaches the target, again only
 * if it drops lower, and re-arms once the price rises back above the target.
 * Restock: emails when a product we last saw out of stock is now available.
 */
export function evaluateAlert(
  before: { price: number | null; stock: "in" | "out" | null },
  after: Tracked,
  settings: PriceAlertSettings
): { item: AlertItem | null; rearm: boolean } {
  const price = after.currentPrice;
  if (price == null) return { item: null, rearm: false };

  const tripped = after.alertThreshold != null && price <= after.alertThreshold;
  const rearm = !tripped && after.lastNotifiedPrice != null;
  if (!settings.emailEnabled) return { item: null, rearm };

  const base = {
    id: after.id, title: after.title, url: after.url, vendor: after.vendor,
    price, previousPrice: before.price, threshold: after.alertThreshold,
  };

  const thresholdDue = after.notifyEmail && tripped && (after.lastNotifiedPrice == null || price < after.lastNotifiedPrice - 0.005);

  if (after.notifyRestock && before.stock === "out" && stockState(after.availability) === "in") {
    return { rearm: false, item: { ...base, reason: "restock", targetHit: thresholdDue } };
  }
  if (thresholdDue) return { rearm: false, item: { ...base, reason: "threshold" } };

  if (after.notifyEmail && settings.dropPercent > 0 && before.price != null && before.price > 0 && price < before.price) {
    const dropPct = ((before.price - price) / before.price) * 100;
    if (dropPct >= settings.dropPercent) return { rearm, item: { ...base, reason: "drop" } };
  }
  return { item: null, rearm };
}

// ── Email ────────────────────────────────────────────────────────────────────

// Titles/vendors come from scraped web pages — untrusted. Always escape.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const money = (n: number) => `$${n.toFixed(2)}`;
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : "#");

export function buildAlertEmail(items: AlertItem[], appUrl?: string) {
  const allRestock = items.every((i) => i.reason === "restock");
  const subject =
    items.length === 1
      ? items[0].reason === "restock"
        ? `Back in stock: ${items[0].title.slice(0, 80)} (${money(items[0].price)})`
        : `Price alert: ${items[0].title.slice(0, 80)} is now ${money(items[0].price)}`
      : allRestock
        ? `${items.length} products are back in stock`
        : `Price alerts: ${items.length} updates on your tracked products`;
  const tag = (i: AlertItem) => (i.reason === "restock" ? "Back in stock" : i.reason === "drop" ? "Price dropped" : "Target reached");

  const text =
    items
      .map((i) => {
        const was = i.previousPrice != null && i.previousPrice !== i.price ? ` (was ${money(i.previousPrice)})` : "";
        const tgt = i.reason === "threshold" && i.threshold != null ? ` — your alert: ${money(i.threshold)}` : "";
        return `• [${tag(i)}] ${i.title}\n  ${money(i.price)}${was}${tgt}\n  ${i.url}`;
      })
      .join("\n\n") + (appUrl ? `\n\nOpen your tracker: ${appUrl}/products` : "") +
    "\n\nYou're getting this because email price alerts are on in Upshift Garage (Settings → Price Alerts).";

  const rows = items
    .map((i) => {
      const was = i.previousPrice != null && i.previousPrice !== i.price
        ? `<span style="color:#888;text-decoration:line-through">${money(i.previousPrice)}</span> ` : "";
      const tgt = i.reason === "threshold" && i.threshold != null
        ? `<div style="color:#888;font-size:12px">Your alert: ${money(i.threshold)}</div>` : "";
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
        <div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#16a34a">${tag(i)}</div>
        <a href="${safeHref(i.url)}" style="font-weight:600;color:#111;text-decoration:none">${esc(i.title)}</a>
        ${i.vendor ? `<div style="color:#888;font-size:12px">${esc(i.vendor)}</div>` : ""}
        <div style="margin-top:4px;font-size:18px">${was}<strong style="color:#16a34a">${money(i.price)}</strong></div>${tgt}
      </td></tr>`;
    })
    .join("");
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:520px">` +
    `<h2 style="margin:0 0 8px">${allRestock ? "Back in stock 📦" : `Price ${items.length === 1 ? "alert" : "alerts"} 🎯`}</h2>` +
    `<table style="width:100%;border-collapse:collapse">${rows}</table>` +
    (appUrl ? `<p><a href="${safeHref(appUrl + "/products")}">Open your tracker</a></p>` : "") +
    `<p style="color:#888;font-size:12px">You're getting this because email price alerts are on in Upshift Garage (Settings → Price Alerts).</p></div>`;
  return { subject, text, html };
}

export async function sendAlertDigest(items: AlertItem[], settings: PriceAlertSettings) {
  const to = await resolveRecipients(settings);
  if (to.length === 0) return { ok: false as const, error: "No recipient email addresses configured" };
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "") || undefined;
  return sendMail({ to: to.join(", "), ...buildAlertEmail(items, appUrl) });
}

export async function sendTestAlert(settings: PriceAlertSettings) {
  return sendAlertDigest(
    [{
      id: "test", title: "Example Coilover Kit (test message)", url: "https://example.com/product",
      vendor: "Example Vendor", price: 849, previousPrice: 999, threshold: 900, reason: "threshold",
    }],
    settings
  );
}

// ── Background / bulk check ──────────────────────────────────────────────────

const g = globalThis as unknown as { __bvPriceCheckRunning?: boolean };

export interface CheckSummary {
  checked: number;
  failed: number;
  alerts: number;
  emailed: boolean;
  emailError?: string;
  skipped?: "busy";
  /** Products dropped from the tracker because their mod was bought / installed / removed. */
  removed?: number;
}

// ── Auto-removing products that have been bought ─────────────────────────────

const REMOVED_LOG_KEY = "price_removed";

export interface RemovedEntry { title: string; status: string; at: string }

export async function getRemovedLog(): Promise<RemovedEntry[]> {
  const row = await prisma.setting.findUnique({ where: { key: REMOVED_LOG_KEY } }).catch(() => null);
  if (!row) return [];
  try { const v = JSON.parse(row.value); return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function clearRemovedLog(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: REMOVED_LOG_KEY } }).catch(() => {});
}

/**
 * Deletes tracked products whose linked mod(s) are all Purchased / Installed /
 * Removed. If ANY other mod (e.g. on another car) still wants the same page and
 * isn't done, the product stays. Products with no linked mod (added by hand)
 * are never touched. Returns how many were removed.
 */
export async function pruneBoughtProducts(): Promise<number> {
  const mods = await prisma.modification.findMany({ where: { link: { not: null } }, select: { link: true, status: true } });
  const active = new Set<string>();
  const done = new Map<string, string>(); // normalized url → status
  for (const m of mods) {
    if (!m.link || !/^https?:\/\//i.test(m.link)) continue;
    const n = normalizeProductUrl(m.link);
    if ((DONE_STATUSES as readonly string[]).includes(m.status)) done.set(n, m.status);
    else active.add(n);
  }
  if (done.size === 0) return 0;
  const products = await prisma.trackedProduct.findMany({ select: { id: true, url: true, title: true } });
  const doomed = products.filter((p) => {
    const n = normalizeProductUrl(p.url);
    return done.has(n) && !active.has(n);
  });
  if (doomed.length === 0) return 0;
  await prisma.trackedProduct.deleteMany({ where: { id: { in: doomed.map((p) => p.id) } } });
  const at = new Date().toISOString();
  const entries: RemovedEntry[] = doomed.map((p) => ({ title: p.title || p.url, status: done.get(normalizeProductUrl(p.url))!, at }));
  const log = [...entries, ...(await getRemovedLog())].slice(0, 30);
  const value = JSON.stringify(log);
  await prisma.setting.upsert({ where: { key: REMOVED_LOG_KEY }, update: { value }, create: { key: REMOVED_LOG_KEY, value } });
  return doomed.length;
}

/**
 * Checks every product that's due (or all of them with `force`), then sends
 * ONE digest email for anything that newly crossed an alert. Products are
 * fetched a couple at a time with a short pause — polite to the shops.
 */
export async function runPriceCheck(opts: { force?: boolean; notify?: boolean } = {}): Promise<CheckSummary> {
  if (g.__bvPriceCheckRunning) return { checked: 0, failed: 0, alerts: 0, emailed: false, skipped: "busy" };
  g.__bvPriceCheckRunning = true;
  try {
    const settings = await getPriceAlertSettings();
    const removed = settings.autoRemoveBought ? await pruneBoughtProducts().catch(() => 0) : 0;
    const cutoff = Date.now() - settings.intervalHours * 60 * 60 * 1000;
    const all = await prisma.trackedProduct.findMany({ select: { id: true, lastChecked: true, currentPrice: true, availability: true, evalPrice: true, stockSeen: true } });
    const due = all.filter((p) => opts.force || !p.lastChecked || p.lastChecked.getTime() <= cutoff);

    const alerts: AlertItem[] = [];
    let checked = 0, failed = 0;

    const work = async (p: (typeof due)[number]) => {
      const after = await refreshProduct(p.id).catch(() => null);
      if (!after) { failed++; return; }
      checked++;
      if (after.lastError) {
        // No fresh data this time — never alert (or re-arm) off a stale price
        failed++;
        return;
      }
      // First time we see a product there's nothing to compare with: baseline from what it was before this check
      const before = {
        price: p.evalPrice ?? p.currentPrice,
        stock: (p.stockSeen as "in" | "out" | null) ?? stockState(p.availability),
      };
      const { item, rearm } = evaluateAlert(before, after, settings);
      await prisma.trackedProduct
        .update({
          where: { id: p.id },
          data: { evalPrice: after.currentPrice, stockSeen: stockState(after.availability) ?? undefined, ...(rearm ? { lastNotifiedPrice: null } : {}) },
        })
        .catch(() => {});
      if (item && opts.notify !== false) alerts.push(item);
    };

    const CONCURRENCY = 2;
    let idx = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, due.length) }, async () => {
        while (idx < due.length) {
          const p = due[idx++];
          await work(p);
          await new Promise((r) => setTimeout(r, 400));
        }
      })
    );

    let emailed = false;
    let emailError: string | undefined;
    if (alerts.length > 0) {
      if (!(await isSmtpConfigured())) {
        emailError = "Email server isn't set up (Settings → Price Alerts → Email server)";
      } else {
        const res = await sendAlertDigest(alerts, settings);
        if (res.ok) {
          emailed = true;
          const now = new Date();
          await Promise.all(alerts.map((a) =>
            prisma.trackedProduct.update({
              where: { id: a.id },
              // Only a target-price email arms the "don't repeat" memory; restock/drop emails don't
              data: { lastNotifiedAt: now, ...(a.reason === "threshold" || a.targetHit ? { lastNotifiedPrice: a.price } : {}) },
            }).catch(() => {})
          ));
        } else {
          emailError = res.error;
        }
      }
      if (emailError) console.error("[price-tracker] alert email not sent:", emailError);
    }

    return { checked, failed, alerts: alerts.length, emailed, emailError, removed };
  } finally {
    g.__bvPriceCheckRunning = false;
  }
}

// ── Creating a tracked product ───────────────────────────────────────────────

/** Scrape a URL and start tracking it (or return the existing one, matched on the normalized URL). */
export async function trackUrl(url: string): Promise<{ product: Tracked; created: boolean }> {
  const norm = normalizeProductUrl(url);
  const existing = (await prisma.trackedProduct.findMany({ select: { id: true, url: true } }))
    .find((p) => normalizeProductUrl(p.url) === norm);
  if (existing) {
    const product = await prisma.trackedProduct.findUnique({ where: { id: existing.id }, include: PRODUCT_INCLUDE });
    return { product: product!, created: false };
  }

  const scraped = await scrapeProduct(url); // throws on SSRF/validation problems
  const product = await prisma.trackedProduct.create({
    data: {
      url,
      title: scraped.title,
      brand: scraped.brand,
      imageUrl: scraped.imageUrl,
      description: scraped.description,
      currentPrice: scraped.price,
      lowestPrice: scraped.price,
      highestPrice: scraped.price,
      vendor: scraped.vendor,
      availability: scraped.availability,
      sku: scraped.sku,
      lastChecked: new Date(),
      evalPrice: scraped.price,
      stockSeen: stockState(scraped.availability),
      lastError: scraped.failed
        ? scraped.error ?? "Couldn't load the page"
        : scraped.price == null ? "Couldn't read a price from this page" : null,
      priceHistory: scraped.price ? { create: { price: scraped.price } } : undefined,
    },
    include: PRODUCT_INCLUDE,
  });
  return { product, created: true };
}
