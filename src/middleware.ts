import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bv_session";

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isLocalRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (request.ip ?? "");
  return ip === "" || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "::ffff:127.0.0.1";
}

export async function middleware(request: NextRequest) {
  const remoteEnabled  = process.env.BUILDVERSE_REMOTE_ENABLED === "1";
  const passwordHash   = process.env.BUILDVERSE_REMOTE_PASSWORD_HASH;
  const googleClientId = process.env.GOOGLE_AUTH_CLIENT_ID;

  // Gate only activates when remote access is enabled AND some auth method is configured
  if (!remoteEnabled || (!passwordHash && !googleClientId)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Always pass: Next.js internals, login page, auth APIs, OAuth callbacks
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/oauth/") ||
    pathname === "/login" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Bypass for local connections (Electron window, same-machine browser)
  if (isLocalRequest(request)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(COOKIE_NAME)?.value;

  // Password session
  if (passwordHash) {
    const expectedPassword = await sha256hex(passwordHash + "bv-ok");
    if (session === expectedPassword) return NextResponse.next();
  }

  // Google session
  if (googleClientId) {
    const expectedGoogle = await sha256hex(googleClientId + "bv-google-session");
    if (session === expectedGoogle) return NextResponse.next();
  }

  // Save intended destination, redirect to login
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  const response = NextResponse.redirect(url);
  response.cookies.set("bv_login_from", pathname, { httpOnly: true, sameSite: "lax", maxAge: 300, path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
