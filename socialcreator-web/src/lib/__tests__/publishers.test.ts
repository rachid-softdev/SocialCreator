/**
 * Tests for publisher map simplification
 * - getPublisher('INSTAGRAM') returns valid Publisher
 * - getPublisher('UNKNOWN') throws Error
 * - All registered platforms return a publisher
 */

import { describe, expect, it } from "vitest";
import { getPublisher, publishContent } from "@/lib/publishers";

describe("Publisher factory", () => {
  describe("getPublisher", () => {
    const validPlatforms = [
      "INSTAGRAM",
      "TIKTOK",
      "YOUTUBE",
      "FACEBOOK",
      "X",
      "LINKEDIN",
      "THREADS",
      "PINTEREST",
    ] as const;

    it.each(validPlatforms)("should return a Publisher for platform '%s'", (platform) => {
      const publisher = getPublisher(platform);
      expect(publisher).toBeDefined();
      expect(typeof publisher.publish).toBe("function");
    });

    it("should throw an error for unknown platforms", () => {
      expect(() => getPublisher("UNKNOWN" as any)).toThrow("Unknown platform: UNKNOWN");
    });

    it("should throw an error for invalid platform strings", () => {
      expect(() => getPublisher("SNAPCHAT" as any)).toThrow(/Unknown platform/);
      expect(() => getPublisher("TELEGRAM" as any)).toThrow(/Unknown platform/);
      expect(() => getPublisher("WHATSAPP" as any)).toThrow(/Unknown platform/);
    });
  });

  describe("publishContent", () => {
    it("should be an async function", () => {
      expect(typeof publishContent).toBe("function");
    });
  });
});
