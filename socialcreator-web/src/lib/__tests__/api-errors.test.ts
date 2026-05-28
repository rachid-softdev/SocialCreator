/**
 * Tests for structured API error responses
 * - unauthorized() produces 401
 * - notFound() produces 404
 * - errorResponse() produces correct status codes and body shape
 * - fromZodError() produces proper validation error
 */

import { describe, expect, it } from "vitest";
import { type ZodError, z } from "zod";
import {
  conflict,
  errorResponse,
  forbidden,
  fromZodError,
  notFound,
  rateLimited,
  unauthorized,
  validationError,
} from "../api-errors";

describe("API Errors", () => {
  describe("errorResponse", () => {
    it("should return a NextResponse with correct status", () => {
      const res = errorResponse(418, "INTERNAL_ERROR", "Test error");
      expect(res.status).toBe(418);
    });

    it("should include error message and code in body", async () => {
      const res = errorResponse(400, "VALIDATION_ERROR", "Invalid input");
      const body = await res.json();

      expect(body).toEqual({
        error: "Invalid input",
        code: "VALIDATION_ERROR",
      });
    });

    it("should include details when provided", async () => {
      const res = errorResponse(422, "VALIDATION_ERROR", "Bad data", { field: "email" });
      const body = await res.json();

      expect(body).toEqual({
        error: "Bad data",
        code: "VALIDATION_ERROR",
        details: { field: "email" },
      });
    });

    it("should omit details when undefined", async () => {
      const res = errorResponse(500, "INTERNAL_ERROR", "Oops");
      const body = await res.json();

      expect(body.details).toBeUndefined();
    });
  });

  describe("unauthorized", () => {
    it("should return 401 status", async () => {
      const res = unauthorized();
      expect(res.status).toBe(401);
    });

    it("should have correct error body", async () => {
      const res = unauthorized();
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized", code: "UNAUTHORIZED" });
    });
  });

  describe("notFound", () => {
    it("should return 404 status", async () => {
      const res = notFound();
      expect(res.status).toBe(404);
    });

    it("should include resource name in message", async () => {
      const res = notFound("Profile");
      const body = await res.json();
      expect(body).toEqual({ error: "Profile not found", code: "NOT_FOUND" });
    });

    it("should use default message when no resource given", async () => {
      const res = notFound();
      const body = await res.json();
      expect(body).toEqual({ error: "Resource not found", code: "NOT_FOUND" });
    });
  });

  describe("validationError", () => {
    it("should return 400 status", async () => {
      const res = validationError("Bad input");
      expect(res.status).toBe(400);
    });

    it("should include details when provided", async () => {
      const res = validationError("Invalid email", { path: "email", reason: "format" });
      const body = await res.json();
      expect(body.details).toEqual({ path: "email", reason: "format" });
    });
  });

  describe("rateLimited", () => {
    it("should return 429 status", async () => {
      const res = rateLimited();
      expect(res.status).toBe(429);
    });
  });

  describe("forbidden", () => {
    it("should return 403 status", async () => {
      const res = forbidden("Access denied");
      expect(res.status).toBe(403);
    });
  });

  describe("conflict", () => {
    it("should return 409 status", async () => {
      const res = conflict("Resource exists");
      expect(res.status).toBe(409);
    });
  });

  describe("fromZodError", () => {
    it("should convert ZodError to 400 response with details", async () => {
      const schema = z.object({ email: z.string().email() });
      try {
        schema.parse({ email: "invalid" });
      } catch (e) {
        const res = fromZodError(e as ZodError);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe("VALIDATION_ERROR");
        expect(body.details).toBeDefined();
        expect(Array.isArray(body.details)).toBe(true);
        expect(body.details[0]).toHaveProperty("path");
        expect(body.details[0]).toHaveProperty("message");
      }
    });

    it("should handle multiple validation errors", async () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().min(18),
      });
      try {
        schema.parse({ name: "", age: 15 });
      } catch (e) {
        const res = fromZodError(e as ZodError);
        const body = await res.json();
        expect(body.details).toHaveLength(2);
      }
    });
  });
});
