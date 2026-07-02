import { NextRequest, NextResponse } from "next/server";
import { pkceStore } from "@/lib/oauth-store";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const port  = req.nextUrl.port || "3456";
  const base  = `http://localhost:${port}`;

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

  // Fetch user email
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

  // Persist tokens in DB
  const expiry = Date.now() + ((tokenData.expires_in as number) ?? 3600) * 1000;
  const saves: Promise<unknown>[] = [
    prisma.setting.upsert({ where: { key: "gdrive_access_token" }, create: { key: "gdrive_access_token", value: tokenData.access_token as string }, update: { value: tokenData.access_token as string } }),
    prisma.setting.upsert({ where: { key: "gdrive_token_expiry" }, create: { key: "gdrive_token_expiry", value: String(expiry) }, update: { value: String(expiry) } }),
    prisma.setting.upsert({ where: { key: "gdrive_user_email" }, create: { key: "gdrive_user_email", value: email }, update: { value: email } }),
  ];
  if (tokenData.refresh_token) {
    saves.push(prisma.setting.upsert({ where: { key: "gdrive_refresh_token" }, create: { key: "gdrive_refresh_token", value: tokenData.refresh_token as string }, update: { value: tokenData.refresh_token as string } }));
  }
  await Promise.all(saves);

  return NextResponse.redirect(`${base}/settings?section=sync&gdrive=connected`);
}
