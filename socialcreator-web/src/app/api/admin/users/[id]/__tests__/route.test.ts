import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    generatedContent: { count: vi.fn() },
    publishLog: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { DELETE, GET, PATCH } from "../route";

function createRequest(
  method: string,
  body?: unknown,
  url = "http://localhost:3000/api/admin/users/test-id",
): Request {
  const options: RequestInit = { method };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  return new Request(url, options);
}

function getParams() {
  return { params: Promise.resolve({ id: "test-user-id" }) };
}

describe("GET /api/admin/users/[id]", () => {
  const mockUser = {
    id: "test-user-id",
    email: "user@test.com",
    name: "Test User",
    image: null,
    role: "USER",
    cguAccepted: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    profiles: [],
    ownedTeams: [],
    teamMemberships: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 when requireAdmin throws AuthError", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await GET(createRequest("GET"), getParams());

      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe("Non authentifié");
    });

    it("should return 403 for non-admin users", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Accès non autorisé", 403));

      const res = await GET(createRequest("GET"), getParams());

      expect(res.status).toBe(403);
    });
  });

  describe("when authorized", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(30);
    });

    it("should return user details with stats", async () => {
      const res = await GET(createRequest("GET"), getParams());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe("test-user-id");
      expect(data.email).toBe("user@test.com");
      expect(data.stats).toEqual({ totalContent: 50, publishedContent: 30 });
    });

    it("should return 404 when user not found", async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await GET(createRequest("GET"), getParams());
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 without admin session", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await PATCH(createRequest("PATCH", { name: "New Name" }), getParams());

      expect(res.status).toBe(401);
    });
  });

  describe("schema validation", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
    });

    it("should return 400 when body is empty", async () => {
      const res = await PATCH(createRequest("PATCH", {}), getParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when role is invalid", async () => {
      const res = await PATCH(createRequest("PATCH", { role: "SUPERADMIN" }), getParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when name is empty string", async () => {
      const res = await PATCH(createRequest("PATCH", { name: "" }), getParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when name exceeds 100 characters", async () => {
      const res = await PATCH(createRequest("PATCH", { name: "x".repeat(101) }), getParams());
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should accept valid name update", async () => {
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-user-id",
        email: "user@test.com",
        name: "New Name",
        role: "USER",
        updatedAt: new Date(),
      });

      const res = await PATCH(createRequest("PATCH", { name: "New Name" }), getParams());

      expect(res.status).toBe(200);
    });

    it("should accept valid role update", async () => {
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-user-id",
        email: "user@test.com",
        name: "Test User",
        role: "ADMIN",
        updatedAt: new Date(),
      });

      const res = await PATCH(createRequest("PATCH", { role: "ADMIN" }), getParams());

      expect(res.status).toBe(200);
    });

    it("should accept both name and role update", async () => {
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-user-id",
        email: "user@test.com",
        name: "Updated Name",
        role: "ADMIN",
        updatedAt: new Date(),
      });

      const res = await PATCH(
        createRequest("PATCH", { name: "Updated Name", role: "ADMIN" }),
        getParams(),
      );

      expect(res.status).toBe(200);
    });
  });

  describe("error handling", () => {
    it("should return 500 when request body is invalid JSON", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      const req = new Request("http://localhost:3000/api/admin/users/test-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json",
      });

      const res = await PATCH(req, getParams());
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
    it("should return 404 when user not found (P2025)", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      });
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);

      const res = await PATCH(createRequest("PATCH", { name: "New Name" }), getParams());
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 without admin session", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await DELETE(createRequest("DELETE"), getParams());

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-admin users", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Accès non autorisé", 403));

      const res = await DELETE(createRequest("DELETE"), getParams());

      expect(res.status).toBe(403);
    });
  });

  describe("when authorized", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
    });

    it("should delete a user successfully", async () => {
      (prisma.user.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "test-user-id",
      });

      const res = await DELETE(createRequest("DELETE"), getParams());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should prevent deleting yourself", async () => {
      const res = await DELETE(createRequest("DELETE"), {
        params: Promise.resolve({ id: "admin-1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Cannot delete your own account");
    });

    it("should return 404 when user not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      });
      (prisma.user.delete as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);

      const res = await DELETE(createRequest("DELETE"), getParams());
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.delete as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected DB error"),
      );

      const res = await DELETE(createRequest("DELETE"), getParams());
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });
});
