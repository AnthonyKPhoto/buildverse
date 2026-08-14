import { NextRequest, NextResponse } from "next/server";

// Reads the identity middleware already verified and attached as headers —
// returns null when auth is disabled (local/Electron mode) or, in principle,
// if this route were ever reached without a valid session (middleware
// already prevents that whenever auth is enabled).
export async function GET(req: NextRequest) {
  const id = req.headers.get("x-user-id");
  const username = req.headers.get("x-user-username");
  const role = req.headers.get("x-user-role");

  if (!id || !username || !role) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: { id, username, role } });
}
