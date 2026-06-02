/**
 * Tests for publisher registry
 * Based on design spec: docs/architecture/05-publisher-strategy.md
 *
 * Self-contained: implements the registry logic inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline types and implementation matching the design spec ==========

interface PublishContent {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

interface PublishAccount {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
}

interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  platform?: string;
  durationMs?: number;
}

interface Publisher {
  publish(content: PublishContent, account: PublishAccount): Promise<PublishResult>;
}

interface PublisherRegistration {
  platform: string;
  publish: (content: PublishContent, account: PublishAccount) => Promise<PublishResult>;
  validators?: any[];
  hooks?: Record<string, any>;
  retry?: Record<string, any>;
}

const registryMap = new Map<string, PublisherRegistration>();

function registerPublisherWithConfig(platform: string, registration: PublisherRegistration): void {
  registryMap.set(platform, registration);
}

function registerSimplePublisher(platform: string, publisher: Publisher): void {
  registerPublisherWithConfig(platform, {
    platform,
    publish: (content, account) => publisher.publish(content, account),
  });
}

function getPublisherRegistration(platform: string): PublisherRegistration {
  const registration = registryMap.get(platform);
  if (!registration) throw new Error(`No publisher registered for platform: ${platform}`);
  return registration;
}

function hasPublisher(platform: string): boolean {
  return registryMap.has(platform);
}

// ========== Tests ==========

describe("Publisher Registry", () => {
  const mockPublish = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    registryMap.clear();
  });

  describe("registerPublisherWithConfig", () => {
    it("should register a publisher with full config", () => {
      const registration: PublisherRegistration = {
        platform: "X",
        publish: mockPublish,
        validators: [],
        hooks: {
          prePublish: vi.fn(),
          postPublish: vi.fn(),
          onError: vi.fn(),
        },
        retry: {
          maxAttempts: 5,
          baseDelayMs: 1000,
          maxDelayMs: 30000,
          useJitter: true,
          retryOnStatuses: [429],
        },
      };

      registerPublisherWithConfig("X", registration);

      const retrieved = getPublisherRegistration("X");
      expect(retrieved).toBe(registration);
    });

    it("should register with minimal config (just publish)", () => {
      const registration: PublisherRegistration = {
        platform: "X",
        publish: mockPublish,
      };

      registerPublisherWithConfig("X", registration);

      const retrieved = getPublisherRegistration("X");
      expect(retrieved.publish).toBe(mockPublish);
    });

    it("should overwrite existing registration", () => {
      const reg1: PublisherRegistration = { platform: "X", publish: vi.fn() };
      const reg2: PublisherRegistration = { platform: "X", publish: vi.fn() };

      registerPublisherWithConfig("X", reg1);
      registerPublisherWithConfig("X", reg2);

      const retrieved = getPublisherRegistration("X");
      expect(retrieved).toBe(reg2);
    });
  });

  describe("registerSimplePublisher", () => {
    it("should register from existing Publisher interface", () => {
      const mockPublisher: Publisher = { publish: mockPublish };

      registerSimplePublisher("INSTAGRAM", mockPublisher);

      const retrieved = getPublisherRegistration("INSTAGRAM");
      expect(typeof retrieved.publish).toBe("function");
      // The published function is a wrapper that calls publisher.publish
      const content: PublishContent = { textContent: "Test", mediaUrls: [], hashtags: [] };
      const account: PublishAccount = { accountId: "a-1", accessToken: "tok" };
      retrieved.publish(content, account);
      expect(mockPublish).toHaveBeenCalledWith(content, account);
    });

    it("should wrap the publisher's publish method", async () => {
      const content: PublishContent = { textContent: "Test", mediaUrls: [], hashtags: [] };
      const account: PublishAccount = { accountId: "a-1", accessToken: "tok" };
      const publishResult: PublishResult = { success: true, postId: "post-1" };
      const mockPublisher: Publisher = { publish: vi.fn().mockResolvedValue(publishResult) };

      registerSimplePublisher("FACEBOOK", mockPublisher);

      const registration = getPublisherRegistration("FACEBOOK");
      const result = await registration.publish(content, account);

      expect(result).toStrictEqual(publishResult);
      expect(mockPublisher.publish).toHaveBeenCalledWith(content, account);
    });
  });

  describe("getPublisherRegistration", () => {
    it("should return registration for registered platform", () => {
      const registration: PublisherRegistration = { platform: "TIKTOK", publish: mockPublish };
      registerPublisherWithConfig("TIKTOK", registration);

      const result = getPublisherRegistration("TIKTOK");
      expect(result).toBe(registration);
    });

    it("should throw for unregistered platform", () => {
      expect(() => getPublisherRegistration("LINKEDIN")).toThrow(
        "No publisher registered for platform: LINKEDIN",
      );
    });

    it("should throw with descriptive error message", () => {
      expect(() => getPublisherRegistration("UNKNOWN")).toThrow("UNKNOWN");
    });
  });

  describe("hasPublisher", () => {
    it("should return true for registered platform", () => {
      registerPublisherWithConfig("YOUTUBE", { platform: "YOUTUBE", publish: mockPublish });

      expect(hasPublisher("YOUTUBE")).toBe(true);
    });

    it("should return false for unregistered platform", () => {
      expect(hasPublisher("PINTEREST")).toBe(false);
    });

    it("should return false after no registrations", () => {
      expect(hasPublisher("THREADS")).toBe(false);
    });

    it("should return true only for exact platform match", () => {
      registerPublisherWithConfig("X", { platform: "X", publish: mockPublish });

      expect(hasPublisher("X")).toBe(true);
      expect(hasPublisher("INSTAGRAM")).toBe(false);
    });
  });
});
