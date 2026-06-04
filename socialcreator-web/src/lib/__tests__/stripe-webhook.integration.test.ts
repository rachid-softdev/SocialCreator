/**
 * Integration tests for Stripe webhook handler
 *
 * Tests the Stripe webhook route handler with mocked dependencies.
 * Mocks Stripe SDK (constructEvent), Prisma, and logger.
 * No real Stripe or database connections are used.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mock factories
const { mockPrisma, mockStripeConstructEvent, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockStripeConstructEvent: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock stripe module: getStripe() returns a mock with webhooks.constructEvent
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockStripeConstructEvent,
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));

// Mock next/headers to avoid request scope errors
const { mockHeaders } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

// Mock cache service to prevent real Redis calls
vi.mock("@/lib/entitlements/cache", () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    publishInvalidation: vi.fn().mockResolvedValue(undefined),
  },
  getEntitlementsCacheKey: vi.fn().mockReturnValue("entitlements:org-1"),
}));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: vi.fn().mockReturnValue({}),
}));

// Import after mocks
import { prisma } from "@/lib/prisma";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test";

describe("Stripe Webhook (Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no idempotency conflict
    vi.mocked(mockPrisma.webhookEvent.findUnique).mockResolvedValue(null);
    vi.mocked(mockPrisma.webhookEvent.create).mockResolvedValue({} as any);

    // Set up the webhook secret env var
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    // Default headers mock returns null (no signature) — override per test
    vi.mocked(mockHeaders).mockResolvedValue(new Headers());
  });

  const createWebhookRequest = (body: string, signature?: string) => {
    return new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature ? { "stripe-signature": signature } : {}),
      },
      body,
    });
  };

  // ============================================
  // Valid subscription.created event
  // ============================================

  it("should process a valid subscription.created event and create subscription", async () => {
    const mockEvent = {
      id: "evt_123",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at_period_end: false,
          items: {
            data: [{ price: { id: "price_starter", unit_amount: 5000 } }],
          },
        },
      },
    };

    // Mock headers to return stripe-signature
    const headersWithSig = new Headers();
    headersWithSig.set("stripe-signature", "valid_signature");
    vi.mocked(mockHeaders).mockResolvedValue(headersWithSig);

    mockStripeConstructEvent.mockReturnValue(mockEvent);
    vi.mocked(mockPrisma.organization.findUnique).mockResolvedValue({
      id: "org-1",
      stripeCustomerId: "cus_123",
    } as any);
    vi.mocked(mockPrisma.subscription.upsert).mockResolvedValue({} as any);
    vi.mocked(mockPrisma.webhookEvent.create).mockResolvedValue({} as any);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest(JSON.stringify(mockEvent), "valid_signature");
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);

    // Verify constructEvent was called with payload and signature
    expect(mockStripeConstructEvent).toHaveBeenCalledWith(
      JSON.stringify(mockEvent),
      "valid_signature",
      webhookSecret,
    );

    // Verify idempotency check
    expect(mockPrisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { eventId: "evt_123" },
    });

    // Verify subscription upsert was called
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-1" },
        create: expect.objectContaining({
          planKey: expect.any(String),
          status: "ACTIVE",
        }),
      }),
    );

    // Verify event was marked as processed
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
      data: { eventId: "evt_123", type: "customer.subscription.created" },
    });
  });

  // ============================================
  // Invalid signature
  // ============================================

  it("should return 400 when signature verification fails", async () => {
    const headersWithSig = new Headers();
    headersWithSig.set("stripe-signature", "invalid_signature");
    vi.mocked(mockHeaders).mockResolvedValue(headersWithSig);

    mockStripeConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest('{"test": true}', "invalid_signature");
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid signature");
  });

  // ============================================
  // Missing signature header
  // ============================================

  it("should return 400 when stripe-signature header is missing", async () => {
    // Default mockHeaders returns empty Headers (no stripe-signature)
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest('{"test": true}'); // no signature header
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing stripe-signature header");
  });

  // ============================================
  // Unknown event type (unhandled)
  // ============================================

  it("should return 200 for unknown event types", async () => {
    const headersWithSig = new Headers();
    headersWithSig.set("stripe-signature", "valid_sig");
    vi.mocked(mockHeaders).mockResolvedValue(headersWithSig);

    const mockEvent = {
      id: "evt_unknown",
      type: "charge.succeeded",
      data: { object: { id: "ch_123" } },
    };

    mockStripeConstructEvent.mockReturnValue(mockEvent);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest(JSON.stringify(mockEvent), "valid_sig");
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
  });

  // ============================================
  // Already processed event (idempotency)
  // ============================================

  it("should skip already processed events (idempotency)", async () => {
    const headersWithSig = new Headers();
    headersWithSig.set("stripe-signature", "valid_sig");
    vi.mocked(mockHeaders).mockResolvedValue(headersWithSig);

    const mockEvent = {
      id: "evt_already_done",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_pro", unit_amount: 7000 } }] },
        },
      },
    };

    mockStripeConstructEvent.mockReturnValue(mockEvent);
    // Idempotency: already processed
    vi.mocked(mockPrisma.webhookEvent.findUnique).mockResolvedValue({
      eventId: "evt_already_done",
      type: "customer.subscription.updated",
    } as any);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest(JSON.stringify(mockEvent), "valid_sig");
    const response = await POST(request);

    expect(response.status).toBe(200);
    // Should NOT create another webhook event record
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  // ============================================
  // Empty body
  // ============================================

  it("should return 400 for empty request body", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("", "valid_sig");
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Empty request body");
  });

  // ============================================
  // Payload too large
  // ============================================

  it("should return 413 for oversized payload", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const oversizedBody = "x".repeat(1_000_001);
    const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-length": String(oversizedBody.length),
        "stripe-signature": "sig",
      },
      body: oversizedBody,
    });
    const response = await POST(request);

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error).toContain("Payload too large");
  });

  // ============================================
  // Customer not found (organization)
  // ============================================

  it("should return 400 when customer has no organization", async () => {
    const headersWithSig = new Headers();
    headersWithSig.set("stripe-signature", "valid_sig");
    vi.mocked(mockHeaders).mockResolvedValue(headersWithSig);

    const mockEvent = {
      id: "evt_no_org",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_unknown",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: "price_starter", unit_amount: 5000 } }] },
        },
      },
    };

    mockStripeConstructEvent.mockReturnValue(mockEvent);
    // No org found
    vi.mocked(mockPrisma.organization.findUnique).mockResolvedValue(null);
    // No user found
    vi.mocked(mockPrisma.user.findFirst).mockResolvedValue(null);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest(JSON.stringify(mockEvent), "valid_sig");
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Organization not found");
  });
});
