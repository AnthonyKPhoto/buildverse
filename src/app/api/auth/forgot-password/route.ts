import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthEnabled } from "@/lib/auth/password";
import { generateResetToken, RESET_TOKEN_LIFETIME_MS } from "@/lib/auth/reset-token";
import { getClientKey, createRateLimiter } from "@/lib/auth/rate-limit";
import { sendPasswordResetEmail } from "@/lib/mailer";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

// Two independent limits: per-IP caps how many usernames one requester can
// probe (open-internet DDoS/abuse protection, as requested), per-username
// caps how many times a single account's inbox can be bombed regardless of
// how many different IPs are used.
const ipLimiter = createRateLimiter(5, 60 * 60 * 1000);
const usernameLimiter = createRateLimiter(3, 60 * 60 * 1000);

// Always the same response shape/message whether the username exists, has no
// email on file, or SMTP isn't configured — the only thing that should ever
// differ observably is the rate-limit response, same as the login route.
const GENERIC_RESPONSE = {
  success: true,
  message: "If that account exists and has an email on file, a reset link has been sent.",
};

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not configured on this deployment" }, { status: 400 });
  }

  const ipKey = getClientKey(req);
  if (ipLimiter.isLimited(ipKey)) {
    return NextResponse.json({ error: "Too many requests — try again later" }, { status: 429 });
  }

  let username = "";
  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  ipLimiter.record(ipKey);
  if (usernameLimiter.isLimited(username)) {
    // Still generic — don't confirm the username exists just because its
    // limiter has entries.
    return NextResponse.json(GENERIC_RESPONSE);
  }
  usernameLimiter.record(username);

  const user = await prisma.user.findUnique({ where: { username } });
  if (user?.email) {
    const { raw, hash } = generateResetToken();
    // Invalidate any previously-requested links for this user — only the
    // newest one should ever work.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TOKEN_LIFETIME_MS) },
    });
    const resetUrl = `${req.nextUrl.origin}/reset-password?token=${raw}`;
    const result = await sendPasswordResetEmail(user.email, user.username, resetUrl);
    if (!result.ok) {
      console.error("[POST /api/auth/forgot-password] failed to send email:", result.error);
    }
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
