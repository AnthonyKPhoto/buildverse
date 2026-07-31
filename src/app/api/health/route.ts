import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/password";
import pkg from "../../../../package.json";

// force-dynamic is load-bearing here, not decorative: this GET takes no
// params and touches nothing Next.js recognizes as a dynamic API (no
// headers()/cookies()/searchParams), so without this it gets statically
// evaluated once at `next build` and the result cached forever — in Docker,
// that means the image is built in CI where AUTH_SESSION_SECRET is never
// set, baking in mode:"local" permanently regardless of the real runtime
// env var. Every admin section in Settings gates on health.mode==="server",
// so this alone was enough to make the whole feature invisible in Docker.
export const dynamic = "force-dynamic";

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
