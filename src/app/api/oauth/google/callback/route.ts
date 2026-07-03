import { NextRequest, NextResponse } from "next/server";
import { consumePkce } from "@/lib/pkce-db";
import { prisma } from "@/lib/prisma";

const DRIVE_CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET ?? "";

function closePage(title: string, icon: string, heading: string, body: string, isError = false) {
  const iconBg  = isError ? "#dc262620" : "#16a34a20";
  const iconBdr = isError ? "#dc262640" : "#16a34a40";
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BuildVerse - ${title}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:1.5rem;padding:3rem;max-width:400px}.icon{width:56px;height:56px;background:${iconBg};border:1px solid ${iconBdr};border-radius:1rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;font-size:1.75rem}h1{font-size:1.375rem;font-weight:700;margin-bottom:.75rem}p{color:#888;font-size:.875rem;line-height:1.6}.btn{display:inline-block;margin-top:1.5rem;padding:.6rem 1.4rem;background:#222;border:1px solid #333;border-radius:.75rem;color:#ccc;font-size:.8rem;cursor:pointer;text-decoration:none}a.btn:hover{background:#2a2a2a}</style>
    </head><body><div class="card"><div class="icon">${icon}</div>
    <h1>${heading}</h1><p>${body}</p>
    <a class="btn" href="javascript:window.close()">Close this tab</a>
    </div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const port  = req.nextUrl.port || "3456";

  if (error) {
    const msg = error === "access_denied" ? "You declined the Google sign-in request." : `Google returned an error: ${error}`;
    return closePage("Sign-in Cancelled", "&#x2715;", "Sign-in Cancelled", msg, true);
  }
  if (!code || !state) {
    return closePage("Sign-in Failed", "&#x2715;", "Sign-in Failed", "Missing required parameters. Please try connecting again from the app.", true);
  }

  const pkce = await consumePkce(state);
  if (!pkce) {
    return closePage("Session Expired", "&#x231B;", "Session Expired", "The sign-in session timed out. Please go back to the app and try connecting again.", true);
  }

  const redirectUri = process.env.BASE_URL
    ? `${process.env.BASE_URL.replace(/\/$/, "")}/api/oauth/google/callback`
    : `http://127.0.0.1:${port}/api/oauth/google/callback`;
  const tokenBody   = new URLSearchParams({
    code,
    client_id:     pkce.clientId,
    client_secret: DRIVE_CLIENT_SECRET,
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
      return closePage("Sign-in Failed", "&#x2715;", "Sign-in Failed", `Could not complete sign-in: ${msg}. Please try again from the app.`, true);
    }
  } catch {
    return closePage("Network Error", "&#x2715;", "Network Error", "Could not reach Google's servers. Check your internet connection and try again.", true);
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

  return closePage(
    "Connected",
    "&#x2713;",
    "Google Drive Connected",
    email ? `Signed in as <strong style="color:#ccc">${email}</strong>.<br><br>You can close this tab - BuildVerse will update automatically.` : "Your account has been linked. You can close this tab - BuildVerse will update automatically.",
  );
}
