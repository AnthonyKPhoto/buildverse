import { NextRequest } from "next/server";

// Shared by the forgot-password/reset-password routes (src/app/api/auth/login/route.ts
// has its own copy of this same pattern predating this file — left as-is rather
// than migrated, to avoid touching a working, already-shipped route).

export function getClientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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
      const entry = attempts.get(key);
      if (!entry || now > entry.resetAt) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        entry.count += 1;
      }
    },
  };
}
