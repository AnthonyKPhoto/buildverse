import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, isAuthEnabled } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Basic in-memory lockout — this is reachable from the open internet.
// Per-process is fine here: the server always runs as one Node process
// (SQLite, not horizontally scaled), same as the rest of the app.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  return !!entry && Date.now() < entry.resetAt && entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not configured on this deployment" }, { status: 400 });
  }

  const key = getClientKey(req);
  if (isRateLimited(key)) {
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

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailedAttempt(key);
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "member",
  });
  const res = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Always true: Caddy terminates TLS in front of this app, so the request
    // Next.js sees is plain HTTP — detecting protocol from it would be wrong.
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
