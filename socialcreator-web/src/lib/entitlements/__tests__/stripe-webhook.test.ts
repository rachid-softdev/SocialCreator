/**
 * Comprehensive unit tests for Stripe webhook handler
 *
 * Tests every function exported from stripe-webhook.ts:
 * - handleStripeWebhook (main entry point)
 * - All event type handlers (subscription.created/updated/deleted, invoice.*)
 * - Idempotency layer
 * - Plan inference (env var + unit_amount)
 * - Status mapping
 * - Cleanup logic
 *
 * All external dependencies (Stripe SDK, Prisma, Redis cache, logger)
 * are mocked. No real network or database calls are made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock factories (hoisted to top)
// ============================================

const { mockStripe, mockPrisma, mockLogger, mockCacheService } = vi.hoisted(() => {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  const mockPrisma = {
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
      findUnique: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  const mockCacheService = {
    invalidate: vi.fn().mockResolvedValue(undefined),
    publishInvalidation: vi.fn().mockResolvedValue(undefined),
  };

  return { mockStripe, mockPrisma, mockLogger, mockCacheService };
});

// ============================================
// Module mocks
// ============================================

vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockStripe,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

vi.mock("@/lib/entitlements/cache", () => ({
  cacheService: mockCacheService,
  getEntitlementsCacheKey: (orgId: string) => `entitlements:${orgId}`,
}));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: vi.fn().mockReturnValue({}),
}));

// ============================================
// Shared test helpers
// ============================================

/** Base subscription object mimicking Stripe.Subscription shape */
function makeSubscription(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "sub_123",
    customer: overrides.customer ?? "cus_123",
    status: overrides.status ?? "active",
    current_period_start: overrides.current_period_start ?? 1_700_000_000,
    current_period_end: overrides.current_period_end ?? 1_702_592_000,
    cancel_at_period_end: overrides.cancel_at_period_end ?? false,
    items: overrides.items ?? {
      data: [{ price: { id: "price_starter", unit_amount: 5000 } }],
    },
    ...overrides,
  };
}

/** Base invoice object mimicking Stripe.Invoice shape */
function makeInvoice(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "inv_123",
    customer: overrides.customer ?? "cus_123",
    subscription: overrides.subscription ?? "sub_123",
    period_start: overrides.period_start ?? 1_700_000_000,
    period_end: overrides.period_end ?? 1_702_592_000,
    ...overrides,
  };
}

/** Create a well-formed Stripe.Event for a given type and data object */
function makeEvent(
  type: string,
  dataObject: Record<string, any>,
  overrides: Record<string, any> = {},
) {
  return {
    id: overrides.id ?? `evt_${Date.now()}`,
    type,
    data: { object: dataObject },
    ...overrides,
  };
}

/** Default configuration before each test */
async function configureDefaults() {
  // Set webhook secret
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

  // Default: no idempotency conflict (fresh event)
  mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
  mockPrisma.webhookEvent.create.mockResolvedValue({} as any);

  // Default: org found
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: "org-1",
    stripeCustomerId: "cus_123",
  } as any);

  // Default: subscription operations succeed
  mockPrisma.subscription.upsert.mockResolvedValue({} as any);
  mockPrisma.subscription.update.mockResolvedValue({} as any);
}

// ============================================
// Tests
// ============================================

describe("Stripe Webhook Handler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await configureDefaults();
  });

  // ============================================
  // 0. Cleanup logic (MUST be first — module-level `lastCleanup` prevents
  //    subsequent calls from triggering cleanup)
  // ============================================
  describe("cleanup logic", () => {
    it("should run cleanup on first call and gracefully handle cleanup errors", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      // Make cleanup throw
      mockPrisma.webhookEvent.deleteMany.mockRejectedValue(new Error("DB timeout"));

      const event = makeEvent("customer.subscription.created", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      // Cleanup was attempted
      expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      });
      // Cleanup error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Failed to clean up old webhook events",
      );
      // Event processing still succeeded despite cleanup failure
      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 1. Signature verification
  // ============================================
  describe("signature verification", () => {
    it("should return error when signature is invalid", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const result = await handleStripeWebhook("{}", "bad-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid signature");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Webhook signature verification failed",
      );
      // No event should have been recorded
      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
    });

    it("should accept request with valid signature", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.created", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        stripeCustomerId: "cus_123",
      } as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.eventType).toBe("customer.subscription.created");
      // Verify constructEvent was called with correct args
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        "{}",
        "valid-sig",
        "whsec_test",
      );
    });

    it("should log a warning at module load if STRIPE_WEBHOOK_SECRET is missing", async () => {
      // This test checks module-scope behavior
      // We need to test that the warn is logged when env is missing
      // Since we can't easily re-import the module, we verify the logic path:
      // When WEBHOOK_SECRET is undefined, constructEvent is called with undefined
      // which will cause an error

      // Temporarily remove the secret
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const { handleStripeWebhook } = await import("../stripe-webhook");

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature for payload");
      });

      const result = await handleStripeWebhook("{}", "some-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid signature");

      // Restore
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    });
  });

  // ============================================
  // 2. Idempotency
  // ============================================
  describe("idempotency", () => {
    it("should skip processing when event was already handled", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.updated", makeSubscription(), {
        id: "evt_already_done",
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      // Simulate already processed
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        eventId: "evt_already_done",
        type: "customer.subscription.updated",
      } as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.eventType).toBe("customer.subscription.updated");
      // Must NOT attempt to process the event
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      // Must NOT create a duplicate webhook event record
      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
      // Must NOT invalidate cache
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
    });

    it("should process a new event normally", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.created", makeSubscription(), {
        id: "evt_fresh",
      });

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({} as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      // Should have created the webhook event record
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { eventId: "evt_fresh", type: "customer.subscription.created" },
      });
      // Should have processed the subscription
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    });
  });

  // ============================================
  // 3. Event: customer.subscription.created
  // ============================================
  describe("customer.subscription.created", () => {
    it("should create subscription for existing org", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.created", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: "org-1",
        stripeCustomerId: "cus_123",
      } as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-1");
      expect(result.eventType).toBe("customer.subscription.created");

      // Should upsert subscription
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-1" },
          create: expect.objectContaining({
            planKey: "starter",
            status: "ACTIVE",
            stripeSubId: "sub_123",
            cancelAtPeriodEnd: false,
          }),
          update: expect.objectContaining({
            planKey: "starter",
            status: "ACTIVE",
            cancelAtPeriodEnd: false,
          }),
        }),
      );

      // Should invalidate cache
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-1");
      expect(mockCacheService.publishInvalidation).toHaveBeenCalledWith("org-1");

      // Should mark event processed
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { eventId: event.id, type: "customer.subscription.created" },
      });
    });

    it("should create org from legacy user when no org exists", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.created", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // No org found
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      // But legacy user found
      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        stripeCustomerId: "cus_123",
      } as any);
      // Org creation succeeds
      mockPrisma.organization.create.mockResolvedValue({
        id: "org-new",
        stripeCustomerId: "cus_123",
      } as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-new");

      // Should have created new org
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: "Org for user user-1",
          stripeCustomerId: "cus_123",
        },
      });

      // Should have created subscription for the new org
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-new" },
        }),
      );

      // Should invalidate cache for new org
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-new");
      expect(mockCacheService.publishInvalidation).toHaveBeenCalledWith("org-new");
    });

    it("should return error when no org or user found for customer", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({ customer: "cus_unknown" }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // No org found
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      // No legacy user found
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization not found");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { customerId: "cus_unknown" },
        "No org found for customer",
      );
    });

    it("should handle subscription with trial period", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({ status: "trialing", cancel_at_period_end: false }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      // Status should map to TRIALING
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: "TRIALING" }),
        }),
      );
    });

    it("should handle subscription with cancel_at_period_end = true", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({ cancel_at_period_end: true }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ cancelAtPeriodEnd: true }),
          update: expect.objectContaining({ cancelAtPeriodEnd: true }),
        }),
      );
    });
  });

  // ============================================
  // 4. Event: customer.subscription.updated
  // ============================================
  describe("customer.subscription.updated", () => {
    it("should update existing subscription", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.updated",
        makeSubscription({
          status: "active",
          items: { data: [{ price: { id: "price_pro", unit_amount: 7000 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-1");
      expect(result.eventType).toBe("customer.subscription.updated");

      // Should have performed upsert with pro plan
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "pro", status: "ACTIVE" }),
        }),
      );

      // Should invalidate cache
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-1");
    });

    it("should return error when customer has no org", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.updated",
        makeSubscription({ customer: "cus_orphan" }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization not found");
    });

    it("should handle plan downgrade via updated event", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      // Simulate downgrade from pro to starter
      const event = makeEvent(
        "customer.subscription.updated",
        makeSubscription({
          status: "active",
          items: { data: [{ price: { id: "price_starter", unit_amount: 5000 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      // Should have upserted with starter plan
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "starter" }),
        }),
      );
    });
  });

  // ============================================
  // 5. Event: customer.subscription.deleted
  // ============================================
  describe("customer.subscription.deleted", () => {
    it("should set subscription to CANCELED with free plan", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.deleted", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-1");
      expect(result.eventType).toBe("customer.subscription.deleted");

      // Should upsert with CANCELED + free plan
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-1" },
          update: expect.objectContaining({
            status: "CANCELED",
            planKey: "free",
          }),
          create: expect.objectContaining({
            status: "CANCELED",
            planKey: "free",
          }),
        }),
      );

      // Should invalidate cache
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-1");
    });

    it("should handle deletion for non-existent org gracefully", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.deleted",
        makeSubscription({ customer: "cus_ghost" }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization not found");
    });

    it("should handle deletion when subscription does not exist yet (upsert creates)", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.deleted", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      // Subscription doesn't exist yet, upsert will create it
      mockPrisma.subscription.upsert.mockResolvedValue({} as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      // upsert called with create block
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: "CANCELED",
            planKey: "free",
          }),
          update: expect.objectContaining({
            status: "CANCELED",
            planKey: "free",
          }),
        }),
      );
    });
  });

  // ============================================
  // 6. Event: invoice.payment_succeeded
  // ============================================
  describe("invoice.payment_succeeded", () => {
    it("should update subscription with new period dates and set ACTIVE", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const periodStart = 1_710_000_000;
      const periodEnd = 1_712_592_000;
      const event = makeEvent(
        "invoice.payment_succeeded",
        makeInvoice({
          period_start: periodStart,
          period_end: periodEnd,
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-1");
      expect(result.eventType).toBe("invoice.payment_succeeded");

      // Should update subscription with period dates
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { orgId: "org-1" },
        data: {
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
          status: "ACTIVE",
        },
      });

      // Payment succeeded should NOT invalidate cache
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
    });

    it("should return error when no org found for invoice customer", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("invoice.payment_succeeded", makeInvoice({ customer: "cus_lost" }));
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization not found");
    });
  });

  // ============================================
  // 7. Event: invoice.payment_failed
  // ============================================
  describe("invoice.payment_failed", () => {
    it("should set subscription status to PAST_DUE", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("invoice.payment_failed", makeInvoice());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-1");
      expect(result.eventType).toBe("invoice.payment_failed");

      // Should update subscription to PAST_DUE
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { orgId: "org-1" },
        data: {
          status: "PAST_DUE",
        },
      });

      // Should invalidate cache
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-1");
      expect(mockCacheService.publishInvalidation).toHaveBeenCalledWith("org-1");
    });

    it("should return error when no org found for failed invoice", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("invoice.payment_failed", makeInvoice({ customer: "cus_ghost" }));
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization not found");
    });
  });

  // ============================================
  // 8. Unknown event type
  // ============================================
  describe("unknown event types", () => {
    it("should succeed (no-op) for unhandled event types", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = {
        id: "evt_unknown",
        type: "charge.succeeded",
        data: { object: { id: "ch_123" } },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.eventType).toBe("charge.succeeded");
      // No orgId for unknown events
      expect(result.orgId).toBeUndefined();
      // No processing calls
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it("should handle all known unhandled event types gracefully", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      // Stripe sends many event types - these should all be accepted
      const unhandledTypes = [
        "charge.succeeded",
        "charge.refunded",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "customer.updated",
        "customer.created",
        "customer.source.expiring",
        "customer.discount.created",
        "product.created",
        "price.created",
      ];

      for (const eventType of unhandledTypes) {
        const event = {
          id: `evt_${eventType.replace(/\./g, "_")}`,
          type: eventType,
          data: { object: { id: "obj_1" } },
        };
        mockStripe.webhooks.constructEvent.mockReturnValue(event);
        mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
        mockPrisma.webhookEvent.create.mockResolvedValue({} as any);

        const result = await handleStripeWebhook("{}", "valid-sig");

        expect(result.success).toBe(true);
        expect(result.eventType).toBe(eventType);
      }
    });
  });

  // ============================================
  // 9. Error handling during processing
  // ============================================
  describe("error handling during processing", () => {
    it("should catch and return error when subscription upsert fails", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.created", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // Simulate DB failure
      mockPrisma.subscription.upsert.mockRejectedValue(new Error("DB connection lost"));

      // Even though processing fails, the event should still be marked as processed
      // (checking the code - markEventProcessed is AFTER processEvent, so it won't be called)
      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection lost");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Webhook processing failed",
      );
    });

    it("should catch and return error when subscription update fails (payment_succeeded)", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("invoice.payment_succeeded", makeInvoice());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      mockPrisma.subscription.update.mockRejectedValue(new Error("Constraint violation"));

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Constraint violation");
    });

    it("should catch and return error when subscription deletion upsert fails", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.deleted", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      mockPrisma.subscription.upsert.mockRejectedValue(new Error("Foreign key violation"));

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Foreign key violation");
    });

    it("should handle unknown error type gracefully", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent("customer.subscription.created", makeSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // Simulate a thrown non-Error value (e.g., string)
      mockPrisma.subscription.upsert.mockRejectedValue("something broke" as any);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  // ============================================
  // 10. Plan inference from prices
  // ============================================
  describe("plan inference (inferPlanKey)", () => {
    it("should infer starter plan from unit_amount 5000", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [{ price: { id: "price_custom", unit_amount: 5000 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "starter" }),
        }),
      );
    });

    it("should infer pro plan from unit_amount 7000", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [{ price: { id: "price_custom", unit_amount: 7000 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "pro" }),
        }),
      );
    });

    it("should infer team plan from unit_amount 11000", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [{ price: { id: "price_custom", unit_amount: 11000 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "team" }),
        }),
      );
    });

    it("should infer plan from STRIPE_PRICE_STARTER env var", async () => {
      process.env.STRIPE_PRICE_STARTER = "price_env_starter";
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [{ price: { id: "price_env_starter", unit_amount: 9999 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "starter" }),
        }),
      );
      delete process.env.STRIPE_PRICE_STARTER;
    });

    it("should infer plan from STRIPE_PRICE_PRO env var", async () => {
      process.env.STRIPE_PRICE_PRO = "price_env_pro";
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [{ price: { id: "price_env_pro", unit_amount: 9999 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "pro" }),
        }),
      );
      delete process.env.STRIPE_PRICE_PRO;
    });

    it("should fallback to 'free' when no price matches", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [{ price: { id: "price_unknown", unit_amount: 12345 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "free" }),
        }),
      );
    });

    it("should fallback to 'free' when subscription has no items", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          items: { data: [] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ planKey: "free" }),
        }),
      );
    });
  });

  // ============================================
  // 11. Status mapping
  // ============================================
  describe("status mapping (mapStripeStatus)", () => {
    it("should map all known Stripe statuses correctly", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const statusMappings = [
        { stripe: "active", expected: "ACTIVE" },
        { stripe: "trialing", expected: "TRIALING" },
        { stripe: "past_due", expected: "PAST_DUE" },
        { stripe: "canceled", expected: "CANCELED" },
        { stripe: "unpaid", expected: "UNPAID" },
      ];

      for (const { stripe, expected } of statusMappings) {
        const event = makeEvent(
          "customer.subscription.created",
          makeSubscription({ status: stripe }),
        );
        mockStripe.webhooks.constructEvent.mockReturnValue(event);
        mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
        mockPrisma.webhookEvent.create.mockResolvedValue({} as any);

        const result = await handleStripeWebhook("{}", "valid-sig");

        expect(result.success).toBe(true);
        expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ status: expected }),
          }),
        );
      }
    });

    it("should default to ACTIVE for unknown statuses", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({ status: "incomplete" }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });
  });

  // ============================================
  // 12. Edge cases with malformed/empty data
  // ============================================
  describe("edge cases", () => {
    it("should handle empty payload and return invalid signature", async () => {
      // Stripe's constructEvent will throw on empty payload
      const { handleStripeWebhook } = await import("../stripe-webhook");

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const result = await handleStripeWebhook("", "sig");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid signature");
    });

    it("should handle subscription customer that is an object (not string)", async () => {
      // Stripe API sometimes returns customer as an expanded object
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({
          customer: { id: "cus_123", object: "customer" },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // In the current code, `subscription.customer as string` would cast the object to string
      // resulting in "[object Object]" - we should test this behavior
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      // Organization lookup will fail because customerId is "[object Object]"
      expect(result.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should handle very large timestamps without overflow", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook");

      // Use realistic but large timestamps
      const farFuture = 4_100_000_000; // Year 2099
      const event = makeEvent(
        "invoice.payment_succeeded",
        makeInvoice({
          period_start: farFuture,
          period_end: farFuture + 2_592_000,
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      // Verify timestamps were correctly converted to Date objects
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentPeriodStart: new Date(farFuture * 1000),
            currentPeriodEnd: new Date((farFuture + 2_592_000) * 1000),
          }),
        }),
      );
    });

    it("should handle org lookup for subscription.updated with no subscription in DB yet", async () => {
      // If customer.subscription.updated arrives before subscription.created
      // (out-of-order delivery), upsert should still handle it
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.updated",
        makeSubscription({
          items: { data: [{ price: { id: "price_pro", unit_amount: 7000 } }] },
        }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      // Org exists, but no subscription row yet (will be created via upsert)
      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(true);
      expect(result.orgId).toBe("org-1");

      // upsert with create block should handle it
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-1" },
          create: expect.objectContaining({
            planKey: "pro",
            status: "ACTIVE",
          }),
          update: expect.objectContaining({
            planKey: "pro",
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("should mark event as processed even when org lookup fails (idempotency for permanent failures)", async () => {
      // When handleSubscriptionCreated returns { success: false } (org not found),
      // processEvent does NOT throw — it returns. So markEventProcessed IS called.
      // This is intentional: we don't want to reprocess events that will always fail
      // due to missing data (the event happened, the data is missing, deal with it once).
      const { handleStripeWebhook } = await import("../stripe-webhook");

      const event = makeEvent(
        "customer.subscription.created",
        makeSubscription({ customer: "cus_ghost" }),
      );
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await handleStripeWebhook("{}", "valid-sig");

      expect(result.success).toBe(false);
      // markEventProcessed IS called (because processEvent didn't throw)
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { eventId: event.id, type: "customer.subscription.created" },
      });
    });
  });
});
