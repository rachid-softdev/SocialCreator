import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted, so we use vi.hoisted for shared references
const { mockRequireAdmin, MockAuthError } = vi.hoisted(() => {
  class MockAuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    mockRequireAdmin: vi.fn(),
    MockAuthError,
  };
});

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: mockRequireAdmin,
  AuthError: MockAuthError,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(),
  compare: vi.fn(),
  default: { hash: vi.fn(), compare: vi.fn() },
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
}));

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../route";

function createGetRequest(url = "http://localhost:3000/api/admin/users"): Request {
  return new Request(url);
}

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 when requireAdmin throws AuthError with status 401", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });

    it("should return 403 when requireAdmin throws AuthError with status 403", async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError("Accès non autorisé - rôle administrateur requis", 403),
      );

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("Accès non autorisé");
    });
  });

  describe("when authorized", () => {
    const mockUsers = [
      {
        id: "1",
        email: "user1@test.com",
        name: "User 1",
        role: "USER",
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "2",
        email: "admin@test.com",
        name: "Admin",
        role: "ADMIN",
        createdAt: new Date("2024-01-02"),
      },
    ];
    const expectedUsersJson = [
      {
        id: "1",
        email: "user1@test.com",
        name: "User 1",
        role: "USER",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        email: "admin@test.com",
        name: "Admin",
        role: "ADMIN",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ];

    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUsers);
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    });

    it("should return users list in data field", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data).toEqual(expectedUsersJson);
      expect(data.pagination).toBeDefined();
    });

    it("should query users ordered by createdAt desc", async () => {
      await GET(createGetRequest());

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should select specific user fields", async () => {
      await GET(createGetRequest());

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        }),
      );
    });

    it("should call user.count for pagination total", async () => {
      await GET(createGetRequest());

      expect(prisma.user.count).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected DB error"),
      );

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });

  describe("pagination", () => {
    const mockUsers = [
      {
        id: "1",
        email: "u1@test.com",
        name: "U1",
        role: "USER",
        createdAt: new Date("2024-01-01"),
      },
    ];

    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUsers);
    });

    it("should return default page 1 and limit 20", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      });
    });

    it("should use custom page and limit from query params", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      const res = await GET(
        createGetRequest("http://localhost:3000/api/admin/users?page=2&limit=10"),
      );
      const data = await res.json();

      expect(data.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });

    it("should pass skip and take to prisma query", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      await GET(createGetRequest("http://localhost:3000/api/admin/users?page=3&limit=15"));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 30,
          take: 15,
        }),
      );
    });

    it("should cap limit at 100", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(500);

      await GET(createGetRequest("http://localhost:3000/api/admin/users?limit=999"));

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });

    it("should handle negative page as page 1", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await GET(createGetRequest("http://localhost:3000/api/admin/users?page=-5"));

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
    });

    it("should default to limit 20 when limit is 0 (0 is falsy)", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      await GET(createGetRequest("http://localhost:3000/api/admin/users?limit=0"));

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    });

    it("should apply search filter to both findMany and count", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await GET(createGetRequest("http://localhost:3000/api/admin/users?search=john"));

      const expectedWhere = {
        OR: [
          { email: { contains: "john", mode: "insensitive" } },
          { name: { contains: "john", mode: "insensitive" } },
        ],
      };
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("should not apply search filter when search is empty", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await GET(createGetRequest("http://localhost:3000/api/admin/users?search="));

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(prisma.user.count).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it("should calculate totalPages as 0 when total is 0", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data.pagination.totalPages).toBe(0);
    });

    it("should handle single page of results", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const res = await GET(createGetRequest("http://localhost:3000/api/admin/users?limit=10"));
      const data = await res.json();

      expect(data.pagination.totalPages).toBe(1);
    });

    it("should call both findMany and count in parallel", async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      await GET(createGetRequest());

      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(prisma.user.count).toHaveBeenCalled();
    });
  });
});

describe("POST /api/admin/users", () => {
  const validBody = { email: "newuser@test.com", name: "New User", role: "USER" };
  const mockCreatedUser = {
    id: "user-new-1",
    email: "newuser@test.com",
    name: "New User",
    role: "USER",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
    (bcrypt.hash as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("hashed-pw");
    (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreatedUser);
  });

  describe("authorization", () => {
    it("should return 401 without admin session", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });

    it("should return 403 for non-admin users", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Accès non autorisé", 403));

      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe("Accès non autorisé");
    });
  });

  describe("schema validation", () => {
    it("should return 400 when email is invalid", async () => {
      const res = await POST(createRequest({ email: "not-an-email", role: "USER" }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when role is invalid", async () => {
      const res = await POST(createRequest({ email: "user@test.com", role: "SUPERADMIN" }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when email is missing", async () => {
      const res = await POST(createRequest({ role: "USER" }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should accept valid USER role", async () => {
      const res = await POST(createRequest(validBody));
      expect(res.status).toBe(201);
    });

    it("should accept valid ADMIN role", async () => {
      const res = await POST(createRequest({ email: "admin@test.com", role: "ADMIN" }));
      expect(res.status).toBe(201);
    });
  });

  describe("password handling", () => {
    it("should create user with hashed password when password is provided", async () => {
      const body = { ...validBody, password: "securePass123" };
      await POST(createRequest(body));

      expect(bcrypt.hash).toHaveBeenCalledWith("securePass123", 12);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: "hashed-pw",
          }),
        }),
      );
    });

    it("should create user without password field when password is not provided", async () => {
      await POST(createRequest(validBody));

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            password: expect.anything(),
          }),
        }),
      );
    });

    it("should reject password shorter than 8 characters", async () => {
      const res = await POST(createRequest({ ...validBody, password: "short" }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("role assignment", () => {
    it("should create user with USER role by default", async () => {
      await POST(createRequest(validBody));

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "USER",
          }),
        }),
      );
    });

    it("should create user with ADMIN role when specified", async () => {
      const body = { email: "admin2@test.com", role: "ADMIN" };
      await POST(createRequest(body));

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "ADMIN",
          }),
        }),
      );
    });
  });

  describe("duplicate email handling", () => {
    it("should return 409 when email already exists (P2002)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);

      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toBe("Email already exists");
    });
  });

  describe("response shape", () => {
    it("should return 201 with user object on success", async () => {
      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data).toEqual({ user: mockCreatedUser });
    });
  });

  describe("error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      (prisma.user.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const res = await POST(createRequest(validBody));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });
});
