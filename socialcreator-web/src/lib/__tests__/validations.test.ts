/**
 * Tests for validation schemas
 * - Verify maxPerDay cap changed from 10 to 8
 * - Schema accepts 8 but rejects 9
 */

import { createAgentSchema } from "@socialcreator/types";
import { describe, expect, it } from "vitest";

describe("Validation schemas", () => {
  describe("maxPerDay cap", () => {
    const validAgentBase = {
      profileId: "profile-1",
      name: "Test Agent",
      type: "TEXT_POST" as const,
      platforms: ["X"] as const,
    };

    it("should accept maxPerDay = 8", () => {
      const result = createAgentSchema.safeParse({
        ...validAgentBase,
        maxPerDay: 8,
      });
      expect(result.success).toBe(true);
    });

    it("should reject maxPerDay = 9", () => {
      const result = createAgentSchema.safeParse({
        ...validAgentBase,
        maxPerDay: 9,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Max per day must be at most 8");
      }
    });

    it("should reject maxPerDay = 0 (below minimum)", () => {
      const result = createAgentSchema.safeParse({
        ...validAgentBase,
        maxPerDay: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Max per day must be at least 1");
      }
    });

    it("should accept maxPerDay = 1 (minimum)", () => {
      const result = createAgentSchema.safeParse({
        ...validAgentBase,
        maxPerDay: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should accept missing maxPerDay (optional)", () => {
      const result = createAgentSchema.safeParse(validAgentBase);
      expect(result.success).toBe(true);
    });
  });
});
