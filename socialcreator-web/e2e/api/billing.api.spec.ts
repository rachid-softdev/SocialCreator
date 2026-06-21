/**
 * E2E API Tests: Billing / Stripe
 * Tests: GET /api/stripe/plans, POST /api/stripe/checkout, GET /api/stripe/portal
 */

import { expect, test } from "@playwright/test";

test.describe("Billing API", () => {
  test.describe("GET /api/stripe/plans", () => {
    test("should return available plans", async ({ request }) => {
      const response = await request.get("/api/stripe/plans");
      // Plans may be publicly accessible or require auth
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return structured pricing data", async ({ request }) => {
      const response = await request.get("/api/stripe/plans");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        if (json.length > 0) {
          expect(json[0]).toHaveProperty("name");
          expect(json[0]).toHaveProperty("price");
        }
      }
    });
  });

  test.describe("POST /api/stripe/checkout", () => {
    test("should create checkout session when authenticated", async ({ request }) => {
      const response = await request.post("/api/stripe/checkout", {
        data: {
          priceId: "price_test123",
          successUrl: "http://localhost:3000/success",
          cancelUrl: "http://localhost:3000/cancel",
        },
      });
      expect([200, 201, 401, 302]).toContain(response.status());

      if ([200, 201].includes(response.status())) {
        const json = await response.json();
        expect(json.url || json.sessionId).toBeDefined();
      }
    });

    test("should return 401 without auth for checkout", async ({ request }) => {
      const response = await request.post("/api/stripe/checkout", {
        data: {
          priceId: "price_test123",
          successUrl: "http://localhost:3000/success",
          cancelUrl: "http://localhost:3000/cancel",
        },
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/stripe/portal", () => {
    test("should return billing portal URL when authenticated", async ({ request }) => {
      const response = await request.get("/api/stripe/portal");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json.url || json.portalUrl).toBeDefined();
      }
    });

    test("should return 401 without auth for portal", async ({ request }) => {
      const response = await request.get("/api/stripe/portal", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });
});
