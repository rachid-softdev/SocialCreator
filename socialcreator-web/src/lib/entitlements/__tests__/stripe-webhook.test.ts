/**
 * Feature Flags & Entitlements - Stripe Webhook Tests
 * Tests for idempotency, signature verification, and event handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Stripe from "stripe"

// Mock Stripe
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
}

// Mock prisma
const mockPrisma = {
  organization: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  subscription: {
    upsert: vi.fn(),
    update: vi.fn(),
  },
  webhookEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
}

vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockStripe,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/entitlements/cache", () => ({
  cacheService: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    publishInvalidation: vi.fn().mockResolvedValue(undefined),
  },
  getEntitlementsCacheKey: (orgId: string) => `entitlements:${orgId}`,
}))

describe("Stripe Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // Test 1: Webhook signature invalid → rejection
  // ============================================

  describe("signature verification", () => {
    it("should reject request with invalid signature", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature")
      })

      const result = await handleStripeWebhook("{}", "invalid-signature")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid signature")
    })

    it("should accept request with valid signature", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      const mockEvent = {
        id: "evt_test_123",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            current_period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
            items: {
              data: [{ price: { id: "price_pro", unit_amount: 7000 } }],
            },
            cancel_at_period_end: false,
          },
        },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null) // Not processed
      mockPrisma.webhookEvent.create.mockResolvedValue({})
      mockPrisma.organization.findUnique.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" })
      mockPrisma.organization.create.mockResolvedValue({ id: "org-1" })
      mockPrisma.subscription.upsert.mockResolvedValue({})

      const result = await handleStripeWebhook("{}", "valid-signature")

      expect(result.success).toBe(true)
    })
  })

  // ============================================
  // Test 2: Webhook idempotency (same event 2x)
  // ============================================

  describe("idempotency", () => {
    it("should skip already processed events", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      const mockEvent = {
        id: "evt_test_duplicate",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_123", customer: "cus_123", status: "active" } },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)

      // Event already processed
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        eventId: "evt_test_duplicate",
        type: "customer.subscription.updated",
        processedAt: new Date(),
      })

      const result = await handleStripeWebhook("{}", "valid-signature")

      // Should return success but not process
      expect(result.success).toBe(true)
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled()
    })

    it("should process new events", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      const mockEvent = {
        id: "evt_test_new",
        type: "customer.subscription.created",
        data: { object: { id: "sub_123", customer: "cus_123", status: "active" } },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.webhookEvent.create.mockResolvedValue({})
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" })
      mockPrisma.subscription.upsert.mockResolvedValue({})

      const result = await handleStripeWebhook("{}", "valid-signature")

      expect(result.success).toBe(true)
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled()
    })
  })

  // ============================================
  // Event handlers
  // ============================================

  describe("event handlers", () => {
    it("should handle customer.subscription.created", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      const mockEvent = {
        id: "evt_created",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_new",
            customer: "cus_new",
            status: "active",
            current_period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
            items: { data: [{ price: { id: "price_pro", unit_amount: 7000 } }] },
            cancel_at_period_end: false,
          },
        },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.webhookEvent.create.mockResolvedValue({})
      mockPrisma.organization.findUnique.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" })
      mockPrisma.organization.create.mockResolvedValue({ id: "org-1" })
      mockPrisma.subscription.upsert.mockResolvedValue({})

      const result = await handleStripeWebhook("{}", "valid")

      expect(result.eventType).toBe("customer.subscription.created")
      expect(result.success).toBe(true)
    })

    it("should handle invoice.payment_succeeded", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      const mockEvent = {
        id: "evt_paid",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "inv_123",
            customer: "cus_123",
            subscription: "sub_123",
            period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
            period_end: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.webhookEvent.create.mockResolvedValue({})
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" })
      mockPrisma.subscription.update.mockResolvedValue({})

      const result = await handleStripeWebhook("{}", "valid")

      expect(result.eventType).toBe("invoice.payment_succeeded")
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACTIVE" }),
        })
      )
    })

    it("should handle invoice.payment_failed", async () => {
      const { handleStripeWebhook } = await import("../stripe-webhook")

      const mockEvent = {
        id: "evt_failed",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "inv_failed",
            customer: "cus_123",
          },
        },
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.webhookEvent.create.mockResolvedValue({})
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" })
      mockPrisma.subscription.update.mockResolvedValue({})

      const result = await handleStripeWebhook("{}", "valid")

      expect(result.eventType).toBe("invoice.payment_failed")
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PAST_DUE" }),
        })
      )
    })
  })
})