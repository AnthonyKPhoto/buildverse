import { NextRequest } from "next/server";

// Shared by the login/forgot-password/reset-password routes.

// X-Forwarded-For is client-controllable: a client can send its own value and
// each proxy in front APPENDS to it. The LEFTMOST entry is therefore whatever
// the client claimed (rotating it dodged every limiter); the RIGHTMOST is what
// the nearest proxy actually observed. Use that one.
export function getClientKey(req: NextRequest): string {
  const parts = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return parts?.length ? parts[parts.length - 1] : "unknown";
}

export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return {
    isLimited(key: string): boolean {
      const entry = attempts.get(key);
      return !!entry && Date.now() < entry.resetAt && entry.count >= maxAttempts;
    },
    record(key: string) {
      const now = Date.now();
      // Opportunistic cleanup so the map can't grow without bound.
      if (attempts.size > 10_000) {
        attempts.forEach((v, k) => { if (now > v.resetAt) attempts.delete(k); });
      }
      const entry = attempts.get(key);
      if (!entry || now > entry.resetAt) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        entry.count += 1;
      }
    },
  };
}

/**
 * Origin to put in emailed links. Built from the request's Host header, an
 * attacker can poison it (Host: evil.com) so a reset email points at their
 * site. Set APP_URL to the public URL of the deployment to pin it.
 */
export function getAppOrigin(req: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  console.warn("[security] APP_URL is not set — emailed links use the request Host header, which can be spoofed. Set APP_URL in .env.");
  return req.nextUrl.origin;
}
