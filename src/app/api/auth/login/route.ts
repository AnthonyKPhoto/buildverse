import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, hashPassword, isAuthEnabled } from "@/lib/auth/password";
import { getClientKey, createRateLimiter } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// In-memory lockout — this is reachable from the open internet. Per-process
// is fine: the server always runs as one Node process (SQLite).
// Two limiters: per client address, and per username (so rotating addresses
// can't be used to brute-force one account).
const ipLimiter = createRateLimiter(10, 15 * 60 * 1000);
const userLimiter = createRateLimiter(20, 15 * 60 * 1000);

// Verified against when the username doesn't exist, so "unknown user" costs the
// same scrypt work as "wrong password" and response time doesn't leak which
// usernames are real.
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not configured on this deployment" }, { status: 400 });
  }

  const key = getClientKey(req);
  if (ipLimiter.isLimited(key)) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  let username = "", password = "";
  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  if (userLimiter.isLimited(username.toLowerCase())) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const passwordOk = verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordOk) {
    ipLimiter.record(key);
    userLimiter.record(username.toLowerCase());
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "member",
    mustChangePassword: user.mustChangePassword,
  });
  const res = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Always true: the live deployment always sits behind HTTPS (Caddy/nginx/
    // Cloudflare Tunnel on the homelab host) — detecting protocol from the
    // request would be wrong since that termination happens upstream.
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
