import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAuthEnabled, hashPassword } from "@/lib/auth/password";
import { hashResetToken } from "@/lib/auth/reset-token";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getClientKey, createRateLimiter } from "@/lib/auth/rate-limit";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

// Tokens are 256-bit random, so brute-forcing one isn't realistic — this is
// defense in depth, same spirit as the login route's own limiter.
const ipLimiter = createRateLimiter(10, 60 * 60 * 1000);

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not configured on this deployment" }, { status: 400 });
  }

  const ipKey = getClientKey(req);
  if (ipLimiter.isLimited(ipKey)) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }
  ipLimiter.record(ipKey);

  let token: string, newPassword: string;
  try {
    ({ token, newPassword } = schema.parse(await req.json()));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired — request a new one." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
  });
  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  // Sign the user straight in — same UX as the forced change-password flow,
  // no need to make them type the password they just set a second time.
  const sessionToken = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "member",
    mustChangePassword: false,
  });
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
