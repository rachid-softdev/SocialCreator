import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockCreateBillingPortal = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  createBillingPortal: mockCreateBillingPortal,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest() {
  return new NextRequest("http://localhost:3000/api/stripe/portal", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
  });

  it("should return 200 with portal URL when user has an active subscription", async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      stripeCustomerId: "cus_abc123",
    });
    mockCreateBillingPortal.mockResolvedValue("https://billing.stripe.com/p/session_123");

    const res = await POST(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://billing.stripe.com/p/session_123");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-abc-123" },
      select: { stripeCustomerId: true },
    });
    expect(mockCreateBillingPortal).toHaveBeenCalledWith("cus_abc123");
  });

  it("should return 401 when user is not authenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(createRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when user has no subscription (no stripeCustomerId)", async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      stripeCustomerId: null,
    });

    const res = await POST(createRequest());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("No subscription found");
  });

  it("should return 500 when createBillingPortal throws", async () => {
    (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      stripeCustomerId: "cus_abc123",
    });
    mockCreateBillingPortal.mockRejectedValue(new Error("Stripe API error"));

    const res = await POST(createRequest());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to create billing portal session");
  });
});
