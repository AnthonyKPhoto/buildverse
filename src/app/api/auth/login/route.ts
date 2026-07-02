import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bv_session";

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const passwordHash = process.env.BUILDVERSE_REMOTE_PASSWORD_HASH;
  if (!passwordHash) {
    return NextResponse.json({ error: "Password not configured" }, { status: 400 });
  }

  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const inputHash = await sha256hex(String(password));
    if (inputHash !== passwordHash) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const sessionValue = await sha256hex(passwordHash + "bv-ok");
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, sessionValue, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
