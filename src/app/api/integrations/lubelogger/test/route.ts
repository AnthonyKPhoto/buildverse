import { NextRequest, NextResponse } from "next/server";
import { loadConfig, llFetch, normaliseUrl, LubeLoggerConfig } from "@/lib/lubelogger";

async function tryFetch(cfg: LubeLoggerConfig, path: string) {
  return llFetch(cfg, path);
}

async function tryFetchNoAuth(url: string, path: string): Promise<Response> {
  return fetch(`${normaliseUrl(url)}${path}`);
}

async function runTest(cfg: LubeLoggerConfig) {
  if (!cfg.url) return NextResponse.json({ error: "No URL configured" }, { status: 400 });

  try {
    const res = await tryFetch(cfg, "/api/vehicles");
    const contentType = res.headers.get("content-type") ?? "";

    if (!res.ok) {
      if (contentType.includes("text/html")) {
        return NextResponse.json(
          { error: "Your reverse proxy (Authelia/nginx) is blocking the request. Use API Key auth and configure your proxy to forward the Authorization header to LubeLogger." },
          { status: 502 }
        );
      }

      // 500 with API Key often means auth is disabled and Bearer token confused it — retry without auth
      if (res.status === 500 && cfg.authType === "apikey") {
        const retry = await tryFetchNoAuth(cfg.url, "/api/vehicles").catch(() => null);
        if (retry?.ok) {
          const retryType = retry.headers.get("content-type") ?? "";
          if (!retryType.includes("text/html")) {
            const vehicles = await retry.json().catch(() => []);
            return NextResponse.json({
              ok: true,
              url: normaliseUrl(cfg.url),
              vehicleCount: Array.isArray(vehicles) ? vehicles.length : 0,
              note: "Connected without auth — LubeLogger appears to have authentication disabled",
            });
          }
        }
        return NextResponse.json(
          { error: "API key was rejected (500). In LubeLogger go to ⚙ Settings → scroll to 'Root User API Key' and copy that value here. Or switch to Username + Password and enter your LubeLogger login (not your SSO/proxy credentials)." },
          { status: 502 }
        );
      }

      // 401 after basic/cookie login = session cookie not accepted by the API
      if (res.status === 401 && cfg.authType === "basic") {
        return NextResponse.json(
          { error: "Login succeeded but LubeLogger rejected the session on API calls. Switch to API Key auth — in LubeLogger go to ⚙ Settings → Root User API Key and paste that value here." },
          { status: 502 }
        );
      }
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `LubeLogger returned ${res.status}`, detail: text.slice(0, 200) },
        { status: 502 }
      );
    }

    if (contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Your reverse proxy (Authelia/nginx) is blocking the request. Use API Key auth and configure your proxy to forward the Authorization header to LubeLogger." },
        { status: 502 }
      );
    }

    const vehicles = await res.json();
    return NextResponse.json({
      ok: true,
      url: normaliseUrl(cfg.url),
      vehicleCount: Array.isArray(vehicles) ? vehicles.length : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly =
      msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")
        ? `Cannot reach ${normaliseUrl(cfg.url)} — check the URL and that LubeLogger is running`
        : msg;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}

export async function GET() {
  const cfg = await loadConfig();
  return runTest(cfg);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const stored = await loadConfig();

  const cfg: LubeLoggerConfig = {
    ...stored,
    url:      body.url      ?? stored.url,
    authType: body.authType ?? stored.authType,
    username: body.username ?? stored.username,
    apiKey:   (body.apiKey   && body.apiKey   !== "••••••••") ? body.apiKey   : stored.apiKey,
    password: (body.password && body.password !== "••••••••") ? body.password : stored.password,
  };

  return runTest(cfg);
}
