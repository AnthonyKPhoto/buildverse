import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/password";
import pkg from "../../../../package.json";

// Unauthenticated on purpose — used as the Docker healthcheck and by clients
// (Electron's "Server Connection" test, the login page) to tell a local
// deployment apart from a server one before any session exists.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: pkg.version,
    mode: isAuthEnabled() ? "server" : "local",
  });
}
