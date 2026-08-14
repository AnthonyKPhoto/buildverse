import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Any path with a file extension (favicon.ico, logo.svg, icon-192.png, …) —
// always public, regardless of auth state.
const PUBLIC_FILE = /\.[^/]+$/;

// Paths that must stay reachable even when auth is enforced, so the login
// page itself (and the endpoints it depends on) can render and be used.
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/health"]);

// A client could otherwise set these directly on the incoming request and
// have a downstream route trust them as if middleware had verified them.
function stripIdentityHeaders(req: NextRequest): Headers {
  const headers = new Headers(req.headers);
  headers.delete("x-user-id");
  headers.delete("x-user-username");
  headers.delete("x-user-role");
  return headers;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_FILE.test(pathname) || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers: stripIdentityHeaders(req) } });
  }

  // Auth is entirely inert unless a Docker/server deployment has bootstrapped
  // an admin account — local dev and the Electron app in local mode never see it.
  if (!process.env.ADMIN_PASSWORD_HASH) {
    return NextResponse.next({ request: { headers: stripIdentityHeaders(req) } });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const claims = token ? await verifySessionToken(token) : null;

  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forward identity to downstream routes as headers — API routes (e.g. the
  // admin user-management endpoints) trust these instead of re-verifying the
  // JWT or querying Prisma again, since middleware already did that work.
  const headers = stripIdentityHeaders(req);
  headers.set("x-user-id", claims.userId);
  headers.set("x-user-username", claims.username);
  headers.set("x-user-role", claims.role);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
