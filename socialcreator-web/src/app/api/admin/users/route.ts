import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

const VALID_ROLES = ["USER", "ADMIN"] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(VALID_ROLES),
  password: z.string().min(8).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userRoles: { select: { role: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ users });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, name, password, role } = parsed.data;
    const user = await prisma.user.create({
      data: {
        email,
        name,
        ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
        role,
        userRoles: {
          create: [{ role }],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userRoles: { select: { role: true } },
      },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if ((e as any)?.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
