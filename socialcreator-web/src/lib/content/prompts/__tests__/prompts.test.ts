/**
 * Tests for Platform-specific Prompt Templates
 *
 * Verifies:
 * - Each template has required fields
 * - buildUserPrompt includes brief
 * - Resolver maps correctly
 * - Unknown platform throws
 */

import { describe, expect, it } from "vitest";
import { getAllPromptTemplates, getPromptForPlatform } from "../index";

describe("Platform Prompt Templates", () => {
  describe("getPromptForPlatform", () => {
    it("should return template for X", () => {
      const template = getPromptForPlatform("X");
      expect(template.platform).toBe("X");
      expect(template.maxChars).toBe(280);
      expect(template.systemPrompt).toBeTruthy();
      expect(typeof template.buildUserPrompt).toBe("function");
    });

    it("should return template for LINKEDIN", () => {
      const template = getPromptForPlatform("LINKEDIN");
      expect(template.platform).toBe("LINKEDIN");
      expect(template.maxChars).toBe(3000);
    });

    it("should return template for INSTAGRAM", () => {
      const template = getPromptForPlatform("INSTAGRAM");
      expect(template.platform).toBe("INSTAGRAM");
      expect(template.maxChars).toBe(2200);
    });

    it("should return template for TIKTOK", () => {
      const template = getPromptForPlatform("TIKTOK");
      expect(template.platform).toBe("TIKTOK");
      expect(template.maxChars).toBe(150);
    });

    it("should return template for FACEBOOK", () => {
      const template = getPromptForPlatform("FACEBOOK");
      expect(template.platform).toBe("FACEBOOK");
      expect(template.maxChars).toBe(5000);
    });

    it("should return template for THREADS", () => {
      const template = getPromptForPlatform("THREADS");
      expect(template.platform).toBe("THREADS");
      expect(template.maxChars).toBe(500);
    });

    it("should return template for PINTEREST", () => {
      const template = getPromptForPlatform("PINTEREST");
      expect(template.platform).toBe("PINTEREST");
      expect(template.maxChars).toBe(500);
    });

    it("should return template for YOUTUBE", () => {
      const template = getPromptForPlatform("YOUTUBE");
      expect(template.platform).toBe("YOUTUBE");
      expect(template.maxChars).toBe(5000);
    });

    it("should throw for unknown platform", () => {
      expect(() => getPromptForPlatform("SNAPCHAT" as any)).toThrow("Unsupported platform");
    });
  });

  describe("buildUserPrompt", () => {
    it("should include brief in the generated prompt", () => {
      const template = getPromptForPlatform("X");
      const prompt = template.buildUserPrompt({ brief: "Test brief content" });
      expect(prompt).toContain("Test brief content");
    });

    it("should include keywords when provided", () => {
      const template = getPromptForPlatform("LINKEDIN");
      const prompt = template.buildUserPrompt({
        brief: "A brief",
        keywords: ["keyword1", "keyword2"],
      });
      expect(prompt).toContain("keyword1");
      expect(prompt).toContain("keyword2");
    });

    it("should include brand voice when provided", () => {
      const template = getPromptForPlatform("INSTAGRAM");
      const prompt = template.buildUserPrompt({
        brief: "A brief",
        brandVoice: "Friendly and playful",
      });
      expect(prompt).toContain("Friendly and playful");
    });

    it("should include contentType when provided (YouTube)", () => {
      const template = getPromptForPlatform("YOUTUBE");
      const prompt = template.buildUserPrompt({
        brief: "A brief",
        contentType: "tutorial",
      });
      expect(prompt).toContain("tutorial");
    });

    it("should request JSON output format", () => {
      const template = getPromptForPlatform("X");
      const prompt = template.buildUserPrompt({ brief: "Test" });
      expect(prompt).toContain("textContent");
      expect(prompt).toContain("hashtags");
    });
  });

  describe("getAllPromptTemplates", () => {
    it("should return all 8 platform templates", () => {
      const templates = getAllPromptTemplates();
      expect(templates).toHaveLength(8);
    });

    it("each template should have required fields", () => {
      const templates = getAllPromptTemplates();
      for (const t of templates) {
        expect(t.platform).toBeTruthy();
        expect(t.maxChars).toBeGreaterThan(0);
        expect(t.systemPrompt).toBeTruthy();
        expect(typeof t.buildUserPrompt).toBe("function");
      }
    });
  });
});
