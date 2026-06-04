import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";

const VALID_ROLES = ["USER", "ADMIN"] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(VALID_ROLES),
  password: z.string().min(8).optional(),
});

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const rateLimited = await withRateLimit(request, { userId: admin.id });
    if (rateLimited) return rateLimited;

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20),
    );
    const search = url.searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (search.trim()) {
      where.OR = [
        { email: { contains: search.trim(), mode: "insensitive" } },
        { name: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const rateLimited = await withRateLimit(request, { userId: admin.id });
    if (rateLimited) return rateLimited;
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
