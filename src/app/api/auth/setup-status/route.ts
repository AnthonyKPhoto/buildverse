import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthEnabled } from "@/lib/auth/password";

// Unauthenticated on purpose — the login page needs this before any session
// exists, to decide whether to show "sign in" or "create the admin account".
export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ needsSetup: false });
  }
  const userCount = await prisma.user.count();
  return NextResponse.json({ needsSetup: userCount === 0 });
}
