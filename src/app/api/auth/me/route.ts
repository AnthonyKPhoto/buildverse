import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// See src/app/api/health/route.ts for why this matters.
export const dynamic = "force-dynamic";

// Reads the identity middleware already verified and attached as headers —
// returns null when auth is disabled (local/Electron mode) or when the
// request came through the loopback bypass (no per-user identity to report).
export async function GET(req: NextRequest) {
  const id = req.headers.get("x-user-id");
  const username = req.headers.get("x-user-username");
  const role = req.headers.get("x-user-role");

  if (!id || !username || !role) {
    return NextResponse.json({ user: null });
  }

  // Theme fields come from the DB (not the JWT) so a fresh sign-in on a new
  // device picks up whatever this account last saved — see ThemeProvider.
  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { accentColor: true, radius: true, font: true, colorScheme: true },
  });

  return NextResponse.json({
    user: {
      id,
      username,
      role,
      accentColor: dbUser?.accentColor ?? null,
      radius: dbUser?.radius ?? null,
      font: dbUser?.font ?? null,
      colorScheme: dbUser?.colorScheme ?? null,
    },
  });
}
