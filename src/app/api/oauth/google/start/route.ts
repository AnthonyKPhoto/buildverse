import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { storePkce } from "@/lib/pkce-db";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id") || "";
  if (!clientId) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const verifier  = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state     = randomBytes(16).toString("hex");

  await storePkce(state, verifier, clientId);

  const port        = req.nextUrl.port || "3456";
  const redirectUri = process.env.BASE_URL
    ? `${process.env.BASE_URL.replace(/\/$/, "")}/api/oauth/google/callback`
    : `http://127.0.0.1:${port}/api/oauth/google/callback`;

  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         "code",
    scope:                 "https://www.googleapis.com/auth/drive.appdata",
    code_challenge:        challenge,
    code_challenge_method: "S256",
    state,
    access_type:           "offline",
    prompt:                req.nextUrl.searchParams.get("reauth") === "1" ? "consent" : "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
