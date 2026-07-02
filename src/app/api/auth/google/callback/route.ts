import { NextRequest, NextResponse } from "next/server";
import { consumePkce } from "@/lib/pkce-db";

const COOKIE_NAME = "bv_session";

function getOrigin(req: NextRequest): string {
  const base = process.env.BASE_URL;
  if (base) return base.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host  = req.headers.get("x-forwarded-host")  || req.nextUrl.host;
  return `${proto}://${host}`;
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  const code   = req.nextUrl.searchParams.get("code");
  const state  = req.nextUrl.searchParams.get("state");
  const error  = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/login?google_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?google_error=missing_params`);
  }

  const pkce = await consumePkce(state);
  if (!pkce) {
    return NextResponse.redirect(`${origin}/login?google_error=state_expired`);
  }

  const clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET;
  const redirectUri  = `${origin}/api/auth/google/callback`;

  const tokenBody = new URLSearchParams({
    code,
    client_id:    pkce.clientId,
    redirect_uri: redirectUri,
    grant_type:   "authorization_code",
    ...(clientSecret ? { client_secret: clientSecret } : { code_verifier: pkce.verifier }),
  });

  let tokenData: Record<string, unknown>;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    tokenBody.toString(),
    });
    tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      const msg = (tokenData.error_description as string) || "token_exchange_failed";
      return NextResponse.redirect(`${origin}/login?google_error=${encodeURIComponent(msg)}`);
    }
  } catch {
    return NextResponse.redirect(`${origin}/login?google_error=network_error`);
  }

  let email = "";
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json() as { email?: string };
      email = info.email ?? "";
    }
  } catch { /* non-fatal */ }

  const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL;
  if (allowedEmail && email.toLowerCase() !== allowedEmail.toLowerCase()) {
    return NextResponse.redirect(`${origin}/login?google_error=unauthorized_email`);
  }

  const sessionValue = await sha256hex(pkce.clientId + "bv-google-session");
  const from = req.cookies.get("bv_login_from")?.value || "/";

  const response = NextResponse.redirect(`${origin}${from}`);
  response.cookies.set(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  response.cookies.delete("bv_login_from");
  return response;
}
