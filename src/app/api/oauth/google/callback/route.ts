import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { pkceStore, tokenPickupStore } from "@/lib/oauth-store";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  // Normalize base to localhost for internal redirects (callback arrives on 127.0.0.1)
  const port = req.nextUrl.port || "3456";
  const base = `http://localhost:${port}`;

  if (error) {
    return NextResponse.redirect(`${base}/settings?section=sync&gdrive_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${base}/settings?section=sync&gdrive_error=missing_params`);
  }

  const pkce = pkceStore.get(state);
  if (!pkce || pkce.expiresAt < Date.now()) {
    pkceStore.delete(state);
    return NextResponse.redirect(`${base}/settings?section=sync&gdrive_error=state_expired`);
  }
  pkceStore.delete(state);

  // Redirect URI must match exactly what was sent in the /start request (127.0.0.1)
  const redirectUri = `http://127.0.0.1:${port}/api/oauth/google/callback`;
  const tokenBody   = new URLSearchParams({
    code,
    client_id:     pkce.clientId,
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
    code_verifier: pkce.verifier,
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
      const msg = (tokenData.error_description as string) || (tokenData.error as string) || "token_exchange_failed";
      return NextResponse.redirect(`${base}/settings?section=sync&gdrive_error=${encodeURIComponent(msg)}`);
    }
  } catch {
    return NextResponse.redirect(`${base}/settings?section=sync&gdrive_error=network_error`);
  }

  const pickupKey = randomBytes(16).toString("hex");
  tokenPickupStore.set(pickupKey, {
    accessToken: tokenData.access_token as string,
    expiresAt:   Date.now() + ((tokenData.expires_in as number) ?? 3600) * 1000,
  });
  setTimeout(() => tokenPickupStore.delete(pickupKey), 5 * 60 * 1000);

  return NextResponse.redirect(`${base}/settings?section=sync&gdrive_pickup=${pickupKey}`);
}
