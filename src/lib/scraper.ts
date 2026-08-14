import dns from "dns/promises";
import net from "net";
import type { LookupOptions, LookupAddress } from "dns";
import { fetch as undiciFetch, Agent } from "undici";

interface ScrapedProduct {
  title: string;
  price: number | null;
  imageUrl: string | null;
  brand: string | null;
  description: string | null;
  availability: string | null;
  vendor: string | null;
  sku: string | null;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function vendorFromDomain(domain: string): string {
  const map: Record<string, string> = {
    "ecstuning.com": "ECS Tuning",
    "fcpeuro.com": "FCP Euro",
    "034motorsport.com": "034Motorsport",
    "integratedengineering.com": "Integrated Engineering",
    "goapr.com": "APR",
    "unitronic.com": "Unitronic",
    "ctsturbo.com": "CTS Turbo",
    "urotuning.com": "UROTuning",
    "bmptuning.com": "BMP Tuning",
    "autozone.com": "AutoZone",
    "rockauto.com": "RockAuto",
    "amazon.com": "Amazon",
    "ebay.com": "eBay",
    "tirerack.com": "Tire Rack",
    "discounttire.com": "Discount Tire",
    "bcsuspensions.com": "BC Racing",
    "h2motorsports.com": "H&R Springs",
  };
  return map[domain] ?? domain;
}

function parsePrice(text: string): number | null {
  const match = text.match(/\$?([\d,]+\.?\d{0,2})/);
  if (!match) return null;
  const val = parseFloat(match[1].replace(/,/g, ""));
  return isNaN(val) ? null : val;
}

// ── SSRF guard ────────────────────────────────────────────────────────────────

/**
 * Returns true when the given IP string falls within a private, loopback,
 * link-local, or otherwise non-routable range.
 *
 * Private ranges blocked:
 *   127.0.0.0/8      loopback
 *   10.0.0.0/8       RFC-1918
 *   172.16.0.0/12    RFC-1918
 *   192.168.0.0/16   RFC-1918
 *   169.254.0.0/16   link-local / AWS EC2 instance metadata
 *   100.64.0.0/10    Carrier-grade NAT (RFC-6598)
 *   0.0.0.0/8        "this" network
 *   ::1              IPv6 loopback
 *   fc00::/7         IPv6 unique local
 *   fe80::/10        IPv6 link-local
 */
function isPrivateIP(ip: string): boolean {
  return [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
    /^::1$/,
    /^fc[0-9a-f]{2}:/i,
    /^fe[89ab][0-9a-f]:/i,
  ].some((r) => r.test(ip));
}

/**
 * Validates that a URL is safe to fetch externally, and returns the
 * DNS-resolved addresses that passed validation so the caller can pin the
 * actual fetch to them (see `pinnedLookup` below).
 *
 * Checks:
 *  1. Protocol must be http or https (blocks file://, ftp://, etc.)
 *  2. Hostname must not be a private/loopback IP literal
 *  3. DNS pre-resolution must not resolve to a private/loopback IP
 *
 * The caller MUST fetch using only the returned `addresses` (never re-resolve
 * the hostname) — otherwise a DNS-rebinding attacker can flip the record
 * between this check and the fetch itself. Pinning the connection closes that
 * gap, which matters now that this server is reachable from the public
 * internet rather than only trusted local processes.
 */
export async function validateScrapingUrl(rawUrl: string): Promise<{ hostname: string; addresses: string[] }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are permitted for product scraping");
  }

  const { hostname } = parsed;

  // Block raw IP literals that fall in private ranges
  if (isPrivateIP(hostname)) {
    throw new Error("Requests to private or loopback addresses are not allowed");
  }

  // DNS pre-resolution — catches hostnames that map to private IPs
  let addresses: string[];
  try {
    addresses = await dns.resolve(hostname);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("private") || err.message.includes("loopback"))
    ) {
      throw err;
    }
    // Unresolvable hostname — fail closed (safer than allowing unknown destinations)
    throw new Error("Unable to resolve URL hostname — request blocked");
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      throw new Error("URL resolves to a private or loopback address");
    }
  }

  return { hostname, addresses };
}

/**
 * Builds a `dns.lookup`-compatible function that always answers with the
 * pre-validated addresses, regardless of what a fresh DNS query would return.
 * Passed to an undici Agent so the real TCP connection can never land
 * anywhere other than the address `validateScrapingUrl` already vetted.
 */
function pinnedLookup(addresses: string[]) {
  const family = net.isIP(addresses[0]) === 6 ? 6 : 4;
  return (
    _hostname: string,
    options: LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
  ) => {
    if (options && options.all) {
      callback(null, addresses.map((address) => ({ address, family })));
    } else {
      callback(null, addresses[0], family);
    }
  };
}

// ── URL sanitizer ─────────────────────────────────────────────────────────────

/**
 * Normalizes protocol-relative URLs and rejects any URL whose scheme is not
 * http or https (guards against javascript: and data: being stored as imageUrls).
 */
function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  // SSRF guard — must be called before any fetch; throws on disallowed targets
  const { addresses } = await validateScrapingUrl(url);

  const domain = extractDomain(url);
  const vendor = vendorFromDomain(domain);

  // Pin the actual connection to the addresses we just validated, so a DNS
  // rebind between the check above and this fetch can't redirect us.
  const agent = new Agent({ connect: { lookup: pinnedLookup(addresses) } });

  try {
    const res = await undiciFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      dispatcher: agent,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const { load } = await import("cheerio");
    const $ = load(html);

    // Title
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      "Unknown Product";

    // Price
    let price: number | null = null;
    const priceSelectors = [
      '[itemprop="price"]',
      ".price",
      ".product-price",
      '[class*="price"]',
      'meta[property="og:price:amount"]',
      'meta[name="twitter:data1"]',
    ];
    for (const sel of priceSelectors) {
      const el = $(sel).first();
      const val = el.attr("content") || el.attr("data-price") || el.text();
      if (val) {
        price = parsePrice(val);
        if (price) break;
      }
    }

    // Image — sanitized to prevent javascript:/data: storage
    const rawImageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      $(".product-image img, .main-image img, [class*=\"product\"] img").first().attr("src") ||
      null;

    // Description
    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $('[itemprop="description"]').first().text().trim() ||
      null;

    // Brand
    const brand =
      $('meta[property="og:brand"]').attr("content") ||
      $('[itemprop="brand"]').first().text().trim() ||
      $('[class*="brand"]').first().text().trim() ||
      null;

    // Availability
    const availability =
      $('[itemprop="availability"]').attr("content") ||
      $('[class*="stock"], [class*="availability"]').first().text().trim() ||
      null;

    // SKU
    const sku =
      $('[itemprop="sku"]').text().trim() ||
      $('[class*="sku"], [class*="part-number"]').first().text().trim() ||
      null;

    return {
      title: title.slice(0, 255),
      price,
      imageUrl: sanitizeImageUrl(rawImageUrl),
      brand: brand ? brand.slice(0, 100) : null,
      description: description ? description.slice(0, 500) : null,
      availability: availability ? availability.slice(0, 50) : null,
      vendor,
      sku: sku ? sku.slice(0, 100) : null,
    };
  } catch (err) {
    // Re-throw SSRF errors so the caller surfaces them as 400, not 500
    if (err instanceof Error && (
      err.message.includes("private") ||
      err.message.includes("loopback") ||
      err.message.includes("hostname") ||
      err.message.includes("Only http")
    )) {
      throw err;
    }
    return {
      title: `Product from ${vendor}`,
      price: null,
      imageUrl: null,
      brand: null,
      description: null,
      availability: null,
      vendor,
      sku: null,
    };
  } finally {
    await agent.close();
  }
}
