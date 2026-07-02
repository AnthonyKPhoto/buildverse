import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { storePkce } from "@/lib/pkce-db";

function getOrigin(req: NextRequest): string {
  const base = process.env.BASE_URL;
  if (base) return base.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host  = req.headers.get("x-forwarded-host")  || req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const clientId     = process.env.GOOGLE_AUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET;
  if (!clientId) {
    return NextResponse.json({ error: "Google login not configured" }, { status: 400 });
  }

  const origin      = getOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state       = randomBytes(16).toString("hex");

  if (clientSecret) {
    await storePkce(state, "", clientId);
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope:         "openid email profile",
      state,
      access_type:   "offline",
      prompt:        "select_account",
    });
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } else {
    const verifier  = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    await storePkce(state, verifier, clientId);
    const params = new URLSearchParams({
      client_id:             clientId,
      redirect_uri:          redirectUri,
      response_type:         "code",
      scope:                 "openid email profile",
      code_challenge:        challenge,
      code_challenge_method: "S256",
      state,
      access_type:           "offline",
      prompt:                "select_account",
    });
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }
}
