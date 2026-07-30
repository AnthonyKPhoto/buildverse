import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { z } from "zod";

// Requires an existing session (middleware already verified it and attached
// x-user-id) — used both for the forced first-change after an admin-created
// temp password, and for a voluntary password change any time after.
const schema = z.object({ newPassword: z.string().min(8).max(200) });

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let newPassword: string;
  try {
    ({ newPassword } = schema.parse(await req.json()));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
  });

  // The old session token still carries mustChangePassword:true — issue a
  // fresh one with it cleared so middleware stops redirecting here.
  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "member",
    mustChangePassword: false,
  });
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
