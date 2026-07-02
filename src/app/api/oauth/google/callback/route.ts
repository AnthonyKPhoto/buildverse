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

  return new NextResponse(
    `<!DOCTYPE html><html><head><title>BuildVerse — Connected</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:1.5rem;padding:3rem;max-width:380px}.icon{width:56px;height:56px;background:#16a34a20;border:1px solid #16a34a40;border-radius:1rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:1.75rem}h1{font-size:1.375rem;font-weight:700;margin-bottom:.5rem}p{color:#888;font-size:.875rem;line-height:1.5;margin-bottom:1.5rem}.note{font-size:.75rem;color:#555}</style>
    </head><body><div class="card"><div class="icon">✓</div>
    <h1>Google Drive Connected</h1>
    <p>Your account has been linked. You can close this tab and return to BuildVerse.</p>
    <p class="note">This tab will close automatically…</p>
    </div><script>setTimeout(()=>window.close(),2500)</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}
