import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthEnabled } from "@/lib/auth/password";

// Session cookies are stateless JWTs (middleware can't touch the database), so
// the role inside one can be stale — a demoted or deleted user would keep
// their old role until the token expires. Anything privileged therefore
// re-checks the live database row via these helpers instead of trusting the
// x-user-role header alone.

export interface VerifiedUser {
  id: string;
  username: string;
  role: "admin" | "member";
}

/** Live DB lookup of the requester. Null if there's no session or the account no longer exists. */
export async function getVerifiedUser(req: NextRequest): Promise<VerifiedUser | null> {
  const id = req.headers.get("x-user-id");
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true },
  });
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role === "admin" ? "admin" : "member" };
}

/**
 * Returns a 401/403 response if the requester isn't a current admin, else null.
 *
 * By default this is strict: with auth disabled (local/Electron mode) there are
 * no accounts, so account-management routes stay unavailable. Pass
 * `allowLocal: true` for shared-data actions (wipe, categories, integrations)
 * that the single local user legitimately performs in local mode.
 */
export async function requireAdmin(req: NextRequest, allowLocal = false): Promise<NextResponse | null> {
  if (!isAuthEnabled()) {
    return allowLocal ? null : NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const user = await getVerifiedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return null;
}
