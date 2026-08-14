import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

const updateUserSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  password: z.string().min(8).max(200).optional(),
});

function requireAdmin(req: NextRequest): NextResponse | null {
  if (req.headers.get("x-user-role") !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

async function isLastAdmin(userId: string): Promise<boolean> {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  return admins.length === 1 && admins[0].id === userId;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const data = updateUserSchema.parse(body);

    if (data.role === "member" && (await isLastAdmin(params.id))) {
      return NextResponse.json(
        { error: "Can't demote the only remaining admin" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.password ? { passwordHash: hashPassword(data.password) } : {}),
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PATCH /api/admin/users/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const requesterId = req.headers.get("x-user-id");
  if (params.id === requesterId) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }
  if (await isLastAdmin(params.id)) {
    return NextResponse.json({ error: "Can't delete the only remaining admin" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
