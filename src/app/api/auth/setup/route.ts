import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isAuthEnabled } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { z } from "zod";

// Self-service first-run setup — reachable without a session, but only ever
// creates a user when the User table is completely empty. Race-safe via a
// transaction: src/lib/prisma.ts serializes SQLite to a single connection, so
// the count-then-create below can't double-admit two "first" admins.
const setupSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _ . - only"),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not configured on this deployment" }, { status: 400 });
  }

  let data;
  try {
    data = setupSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const passwordHash = hashPassword(data.password);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      if (count > 0) throw new Error("ALREADY_SET_UP");
      return tx.user.create({
        data: { username: data.username, role: "admin", passwordHash },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_SET_UP") {
      return NextResponse.json({ error: "Setup has already been completed — sign in instead" }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/auth/setup]", msg);
    return NextResponse.json({ error: "Failed to create the admin account" }, { status: 500 });
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: "admin",
    mustChangePassword: false,
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
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
