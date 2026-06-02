import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
    profile: {
      count: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PUT } from "../route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/cgu-accept", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("CGU Accept API", () => {
  const mockSession = { user: { id: "user-abc-123" } };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.profile.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  });

  describe("authentication", () => {
    it("should return 401 when not authenticated", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await PUT(createRequest({ accepted: true }));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("input validation", () => {
    it("should return 400 when accepted is false", async () => {
      const res = await PUT(createRequest({ accepted: false }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Terms must be accepted");
    });

    it("should return 400 when accepted is undefined", async () => {
      const res = await PUT(createRequest({}));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Terms must be accepted");
    });

    it("should return 400 when accepted is null", async () => {
      const res = await PUT(createRequest({ accepted: null }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Terms must be accepted");
    });
  });

  describe("successful acceptance", () => {
    it("should update user with cguAccepted and cguAcceptedAt", async () => {
      await PUT(createRequest({ accepted: true }));

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-abc-123" },
          data: expect.objectContaining({
            cguAccepted: true,
            cguAcceptedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("should return hasProfile false when user has no profiles", async () => {
      (prisma.profile.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const res = await PUT(createRequest({ accepted: true }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, hasProfile: false });
    });

    it("should return hasProfile true when user has profiles", async () => {
      (prisma.profile.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const res = await PUT(createRequest({ accepted: true }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, hasProfile: true });
    });
  });

  describe("error handling", () => {
    it("should return 500 when prisma user update throws", async () => {
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      const res = await PUT(createRequest({ accepted: true }));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should return 500 when prisma profile count throws", async () => {
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.profile.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Count error"),
      );

      const res = await PUT(createRequest({ accepted: true }));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
