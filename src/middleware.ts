import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Any path with a file extension (favicon.ico, logo.svg, icon-192.png, …) —
// always public, regardless of auth state.
const PUBLIC_FILE = /\.[^/]+$/;

// Paths that must stay reachable even when auth is enforced, so the login
// page itself (and the endpoints it depends on) can render and be used.
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/setup",
  "/api/auth/setup-status",
  "/api/health",
  "/forgot-password",
  "/api/auth/forgot-password",
  "/reset-password",
  "/api/auth/reset-password",
]);

// Reachable even while a forced password change is pending — the page that
// does the changing, and logout (so someone can bail out to a different
// account instead of being stuck).
const PASSWORD_CHANGE_PATHS = new Set(["/change-password", "/api/auth/change-password", "/api/auth/logout"]);

function isLocalRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (request.ip ?? "");
  return ip === "" || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "::ffff:127.0.0.1";
}

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

  // Auth is entirely inert unless a Docker/server deployment has set
  // AUTH_SESSION_SECRET — local dev and the Electron app's local
  // (non-Connected) mode never see it, and the Electron window loading its
  // own spawned local server always counts as local below anyway. Whether an
  // admin account already exists yet (bootstrapped via ADMIN_PASSWORD_HASH,
  // or nobody yet — see /api/auth/setup) doesn't change this check.
  if (!process.env.AUTH_SESSION_SECRET) {
    return NextResponse.next({ request: { headers: stripIdentityHeaders(req) } });
  }

  // Loopback bypass — the Electron window talking to its own spawned local
  // server. Deliberately NOT a subnet/LAN check: other devices (a phone on
  // the same Wi-Fi) still need to sign in as a real user.
  if (isLocalRequest(req)) {
    return NextResponse.next({ request: { headers: stripIdentityHeaders(req) } });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const claims = token ? await verifySessionToken(token) : null;

  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // An admin-created account (temp password, emailed) must set its own
  // password before doing anything else.
  if (claims.mustChangePassword && !PASSWORD_CHANGE_PATHS.has(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Password change required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/change-password", req.url));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
