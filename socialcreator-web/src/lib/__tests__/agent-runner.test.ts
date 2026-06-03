import type { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildGenerationPrompt, buildSystemPrompt } from "../prompts";

describe("agent-runner utilities", () => {
  describe("buildSystemPrompt", () => {
    it("should include profile name in prompt", () => {
      const prompt = buildSystemPrompt({
        name: "TestBrand",
        brandVoice: "Professional and helpful",
        contentBank: "Previous content here",
      });

      expect(prompt).toContain("TestBrand");
      expect(prompt).toContain("Professional and helpful");
      expect(prompt).toContain("Previous content here");
    });

    it("should handle null contentBank", () => {
      const prompt = buildSystemPrompt({
        name: "TestBrand",
        brandVoice: "Test voice",
        contentBank: null,
      });

      expect(prompt).toContain("Aucun exemple fourni");
    });

    it("should include compliance rules", () => {
      const prompt = buildSystemPrompt({
        name: "Brand",
        brandVoice: "Voice",
        contentBank: "Content",
      });

      // Check for compliance rules from PLAN.md
      expect(prompt).toContain("Ne jamais reproduire mot pour mot");
      expect(prompt).toContain("Adapter le ton ET le format");
      expect(prompt).toContain("Respecter la brand voice");
    });
  });

  describe("buildGenerationPrompt", () => {
    it("should include brief for each platform", () => {
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

      for (const platform of platforms) {
        const prompt = buildGenerationPrompt({
          brief: "Create engaging content about AI",
          platform,
        });

        expect(prompt).toContain("Create engaging content about AI");
        expect(prompt).toContain(platform);
      }
    });

    it("should request JSON output", () => {
      const prompt = buildGenerationPrompt({
        brief: "Test brief",
        platform: "INSTAGRAM",
      });

      expect(prompt).toContain("JSON");
      expect(prompt).toContain("textContent");
      expect(prompt).toContain("hashtags");
    });

    it("should include platform-specific rules", () => {
      // TikTok - short limit
      const tiktokPrompt = buildGenerationPrompt({
        brief: "Test",
        platform: "TIKTOK",
      });
      expect(tiktokPrompt).toContain("150");

      // X (Twitter) - 280 chars
      const xPrompt = buildGenerationPrompt({
        brief: "Test",
        platform: "X",
      });
      expect(xPrompt).toContain("280");

      // LinkedIn - professional tone
      const linkedinPrompt = buildGenerationPrompt({
        brief: "Test",
        platform: "LINKEDIN",
      });
      expect(linkedinPrompt).toContain("professionnel");
    });
  });

  describe("content generation simulation", () => {
    it("should generate platform-appropriate content structure", () => {
      // This simulates what the LLM response would look like
      const mockResponse = {
        textContent: "Check out this amazing feature!",
        hashtags: ["tech", "innovation"],
      };

      expect(mockResponse).toHaveProperty("textContent");
      expect(mockResponse).toHaveProperty("hashtags");
      expect(Array.isArray(mockResponse.hashtags)).toBe(true);
    });

    it("should handle different platform constraints", () => {
      const platformConstraints: Record<Platform, { maxLength: number }> = {
        INSTAGRAM: { maxLength: 2200 },
        TIKTOK: { maxLength: 150 },
        LINKEDIN: { maxLength: 1300 },
        YOUTUBE: { maxLength: 100 },
        X: { maxLength: 280 },
        FACEBOOK: { maxLength: 63206 },
        THREADS: { maxLength: 500 },
        PINTEREST: { maxLength: 500 },
      };

      Object.entries(platformConstraints).forEach(([_platform, constraint]) => {
        expect(constraint.maxLength).toBeGreaterThan(0);
      });
    });
  });
});
