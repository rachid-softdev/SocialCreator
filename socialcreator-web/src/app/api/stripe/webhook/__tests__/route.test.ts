import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockHandleStripeWebhook = vi.hoisted(() => vi.fn());
const mockHeadersGet = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/entitlements/stripe-webhook", () => ({
  handleStripeWebhook: mockHandleStripeWebhook,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: mockHeadersGet,
  })),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeadersGet.mockReturnValue("test_signature");
  });

  it("should return 200 with received:true when signature is valid and processing succeeds", async () => {
    mockHandleStripeWebhook.mockResolvedValue({
      success: true,
      eventType: "customer.subscription.created",
      orgId: "org-123",
    });

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid_sig",
        "content-length": "100",
      },
      body: JSON.stringify({ id: "evt_123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should return 413 when payload exceeds max webhook body size", async () => {
    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid_sig",
        "content-length": "2000000",
      },
      body: JSON.stringify({ id: "evt_large" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(413);
    expect(data.error).toBe("Payload too large");
  });

  it("should return 400 when body is empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid_sig",
        "content-length": "0",
      },
      body: "",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Empty request body");
  });

  it("should return 400 when stripe-signature header is missing", async () => {
    mockHeadersGet.mockReturnValue(null);

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "content-length": "50",
      },
      body: JSON.stringify({ id: "evt_123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Missing stripe-signature header");
  });

  it("should return 400 when signature is invalid", async () => {
    mockHandleStripeWebhook.mockResolvedValue({
      success: false,
      error: "Invalid signature",
    });

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid_sig",
        "content-length": "50",
      },
      body: JSON.stringify({ id: "evt_123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid signature");
  });

  it("should return 400 when webhook processing fails", async () => {
    mockHandleStripeWebhook.mockResolvedValue({
      success: false,
      error: "Organization not found",
    });

    const req = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid_sig",
        "content-length": "50",
      },
      body: JSON.stringify({ id: "evt_123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Organization not found");
  });
});
