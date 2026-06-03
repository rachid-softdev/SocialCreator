import type { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildGenerationPrompt, buildSystemPrompt, PLATFORM_PROMPTS } from "../prompts";

describe("prompts", () => {
  describe("PLATFORM_PROMPTS", () => {
    it("should have prompts for all platforms", () => {
      const platforms: Platform[] = [
        "INSTAGRAM",
        "TIKTOK",
        "LINKEDIN",
        "YOUTUBE",
        "X",
        "FACEBOOK",
        "THREADS",
        "PINTEREST",
      ];

      platforms.forEach((platform) => {
        expect(PLATFORM_PROMPTS[platform]).toBeDefined();
        expect(typeof PLATFORM_PROMPTS[platform]).toBe("string");
        expect(PLATFORM_PROMPTS[platform].length).toBeGreaterThan(0);
      });
    });

    it("should respect platform character limits in prompts", () => {
      // TikTok has 150 char limit
      expect(PLATFORM_PROMPTS.TIKTOK).toContain("150");

      // X has 280 char limit
      expect(PLATFORM_PROMPTS.X).toContain("280");
    });
  });

  describe("buildSystemPrompt", () => {
    it("should include profile name", () => {
      const prompt = buildSystemPrompt({
        name: "MyBrand",
        brandVoice: "Professional and friendly",
        contentBank: "Previous posts here",
      });

      expect(prompt).toContain("MyBrand");
    });

    it("should include brand voice", () => {
      const prompt = buildSystemPrompt({
        name: "Test",
        brandVoice: "Funny and sarcastic",
        contentBank: null,
      });

      expect(prompt).toContain("Funny and sarcastic");
    });

    it("should handle null contentBank", () => {
      const prompt = buildSystemPrompt({
        name: "Test",
        brandVoice: "Test voice",
        contentBank: null,
      });

      expect(prompt).toContain("Aucun exemple fourni");
    });

    it("should include absolute rules", () => {
      const prompt = buildSystemPrompt({
        name: "Test",
        brandVoice: "Test",
        contentBank: "Test",
      });

      expect(prompt).toContain("Ne jamais reproduire mot pour mot");
      expect(prompt).toContain("Adapter le ton ET le format");
      expect(prompt).toContain("Respecter la brand voice");
    });
  });

  describe("buildGenerationPrompt", () => {
    it("should include brief and platform", () => {
      const prompt = buildGenerationPrompt({
        brief: "Create a post about AI",
        platform: "INSTAGRAM",
      });

      expect(prompt).toContain("Create a post about AI");
      expect(prompt).toContain("INSTAGRAM");
    });

    it("should include platform-specific rules", () => {
      const prompt = buildGenerationPrompt({
        brief: "Test brief",
        platform: "TIKTOK",
      });

      expect(prompt).toContain("RÈGLES PLATEFORME");
    });

    it("should ask for JSON response", () => {
      const prompt = buildGenerationPrompt({
        brief: "Test",
        platform: "X",
      });

      expect(prompt).toContain("JSON");
      expect(prompt).toContain("textContent");
      expect(prompt).toContain("hashtags");
    });

    it("should request hook for video content", () => {
      const prompt = buildGenerationPrompt({
        brief: "Test brief",
        platform: "TIKTOK",
      });

      expect(prompt).toContain("hook");
    });
  });

  describe("platform constraints", () => {
    it("should generate different prompts for different platforms", () => {
      const instagramPrompt = buildGenerationPrompt({
        brief: "Same brief",
        platform: "INSTAGRAM",
      });

      const tiktokPrompt = buildGenerationPrompt({
        brief: "Same brief",
        platform: "TIKTOK",
      });

      const linkedinPrompt = buildGenerationPrompt({
        brief: "Same brief",
        platform: "LINKEDIN",
      });

      // All should have the brief but different platform rules
      expect(instagramPrompt).not.toBe(tiktokPrompt);
      expect(tiktokPrompt).not.toBe(linkedinPrompt);
    });
  });
});
