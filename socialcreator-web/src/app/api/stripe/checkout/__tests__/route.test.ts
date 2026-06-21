import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockCreateCheckoutSession = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));

// Mock withApiMiddleware as pass-through so the handler is tested directly
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (handler: (ctx: any) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      return handler({ userId: "user-abc-123", request });
    };
  };
  return { withApiMiddleware };
});

vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123", email: "test@example.com" },
    });
  });

  it("should return 200 with checkout URL for a valid plan", async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });

    const res = await POST(createRequest({ plan: "pro", additionalProfiles: 2 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_123");
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-abc-123",
      "test@example.com",
      "pro",
      2,
    );
  });

  it("should return 200 with default additionalProfiles=0 when not specified", async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      sessionId: "cs_test_456",
      url: "https://checkout.stripe.com/pay/cs_test_456",
    });

    const res = await POST(createRequest({ plan: "starter" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBeDefined();
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-abc-123",
      "test@example.com",
      "starter",
      0,
    );
  });

  it("should return 400 when plan is invalid", async () => {
    const res = await POST(createRequest({ plan: "enterprise" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid plan");
  });

  it("should return 400 when plan is missing", async () => {
    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid plan");
  });

  it("should return 400 when user email is not found", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123", email: undefined },
    });

    const res = await POST(createRequest({ plan: "starter" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("User email not found");
  });
});
