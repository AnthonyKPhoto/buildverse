import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Self-only — a signed-in user's own appearance prefs, so their look follows
// them across devices/browsers instead of being stuck in one browser's
// localStorage. No admin path: nobody else can set another user's theme.
const schema = z.object({
  accentColor: z.string().max(50).optional(),
  radius: z.string().max(50).optional(),
  font: z.string().max(50).optional(),
  colorScheme: z.string().max(50).optional(),
});

export async function PUT(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = schema.parse(await req.json());
    await prisma.user.update({ where: { id: userId }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save theme" }, { status: 500 });
  }
}
