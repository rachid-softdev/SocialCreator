import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(),
  compare: vi.fn(),
  default: { hash: vi.fn(), compare: vi.fn() },
}));

vi.mock("@/lib/rate-limit", () => ({
  withRateLimit: vi.fn((_req: any, handler: () => Promise<any>) => handler()),
}));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  const validBody = { name: "Test User", email: "test@example.com", password: "password123" };
  const mockCreatedUser = { id: "user-abc-123", name: "Test User", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    (bcrypt.hash as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("hashed-password-123");
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreatedUser);
  });

  describe("input validation", () => {
    it("should return 400 when name is missing", async () => {
      const res = await POST(createRequest({ email: "test@test.com", password: "password123" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.fieldErrors.name).toBeDefined();
    });

    it("should return 400 when email is missing", async () => {
      const res = await POST(createRequest({ name: "Test", password: "password123" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.fieldErrors.email).toBeDefined();
    });

    it("should return 400 when password is missing", async () => {
      const res = await POST(createRequest({ name: "Test", email: "test@test.com" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.fieldErrors.password).toBeDefined();
    });

    it("should return 400 for invalid email format", async () => {
      const res = await POST(createRequest({ ...validBody, email: "not-an-email" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.fieldErrors.email).toBeDefined();
    });

    it("should return 400 when password is shorter than 8 characters", async () => {
      const res = await POST(createRequest({ ...validBody, password: "short" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
      expect(data.fieldErrors.password).toBeDefined();
    });

    it("should return 400 when email already registered", async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing-user",
      });

      const res = await POST(createRequest(validBody));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Email already registered");
    });
  });

  describe("bcrypt password hashing", () => {
    it("should hash the password with salt rounds 12", async () => {
      await POST(createRequest(validBody));

      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);
    });

    it("should not store the plaintext password in the user data passed to prisma", async () => {
      await POST(createRequest(validBody));

      const createCallArgs = (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCallArgs.data.password).toBe("hashed-password-123");
      expect(createCallArgs.data.password).not.toBe("password123");
    });
  });

  describe("UserRole creation", () => {
    it("should create a UserRole entry with role USER on registration", async () => {
      await POST(createRequest(validBody));

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userRoles: {
              create: [{ role: "USER" }],
            },
          }),
        })
      );
    });

    it("should include cguAccepted in the create data", async () => {
      await POST(createRequest(validBody));

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cguAccepted: false,
          }),
        })
      );
    });
  });

  describe("response shape", () => {
    it("should return 200 on successful registration", async () => {
      const res = await POST(createRequest(validBody));
      expect(res.status).toBe(200);
    });

    it("should return success and user object on successful registration", async () => {
      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(data).toEqual({
        success: true,
        user: {
          id: "user-abc-123",
          name: "Test User",
          email: "test@example.com",
        },
      });
    });

    it("should not expose password in the response", async () => {
      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(data.user).not.toHaveProperty("password");
    });
  });

  describe("error handling", () => {
    it("should return 500 when prisma create throws", async () => {
      (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error")
      );

      const res = await POST(createRequest(validBody));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Internal server error");
    });

    it("should return 500 when bcrypt hash throws", async () => {
      (bcrypt.hash as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Hash error")
      );

      const res = await POST(createRequest(validBody));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Internal server error");
    });

    it("should return 409 on duplicate email (P2002)", async () => {
      (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "5.0.0",
        })
      );
      const res = await POST(createRequest(validBody));
      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.error).toBe("Email already registered");
    });
  });
});
