import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { pkceStore } from "@/lib/oauth-store";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id") || "";
  if (!clientId) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const verifier  = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state     = randomBytes(16).toString("hex");

  // Purge expired entries
  const now = Date.now();
  pkceStore.forEach((v, k) => { if (v.expiresAt < now) pkceStore.delete(k); });

  pkceStore.set(state, { verifier, clientId, expiresAt: now + 10 * 60 * 1000 });

  const redirectUri = `${req.nextUrl.origin}/api/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         "code",
    scope:                 "https://www.googleapis.com/auth/drive.appdata",
    code_challenge:        challenge,
    code_challenge_method: "S256",
    state,
    access_type:           "offline",
    prompt:                "consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
