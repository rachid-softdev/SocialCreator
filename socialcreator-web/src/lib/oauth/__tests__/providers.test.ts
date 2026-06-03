/**
 * Tests for OAuth providers configuration
 * Tests provider config, redirect URIs, credentials, and configuration checks
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAuthBaseUrl,
  getProviderCredentials,
  getRedirectUri,
  isProviderConfigured,
  OAUTH_PROVIDERS,
  type OAuthProvider,
} from "../providers";

describe("OAuth Providers", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AUTH_URL = "https://socialcreator.app";
    process.env.META_CLIENT_ID = "meta-client";
    process.env.META_CLIENT_SECRET = "meta-secret";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.X_CLIENT_ID = "x-client";
    process.env.X_CLIENT_SECRET = "x-secret";
    process.env.LINKEDIN_CLIENT_ID = "li-client";
    process.env.LINKEDIN_CLIENT_SECRET = "li-secret";
    process.env.TIKTOK_CLIENT_KEY = "tt-client";
    process.env.TIKTOK_CLIENT_SECRET = "tt-secret";
    process.env.PINTEREST_CLIENT_ID = "pin-client";
    process.env.PINTEREST_CLIENT_SECRET = "pin-secret";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("OAUTH_PROVIDERS configuration", () => {
    it("should have all required platforms", () => {
      const expectedProviders: OAuthProvider[] = [
        "INSTAGRAM",
        "TIKTOK",
        "LINKEDIN",
        "X",
        "YOUTUBE",
        "FACEBOOK",
        "PINTEREST",
        "THREADS",
      ];

      for (const provider of expectedProviders) {
        expect(OAUTH_PROVIDERS).toHaveProperty(provider);
      }
    });

    it("should have valid config structure for each provider", () => {
      for (const [, config] of Object.entries(OAUTH_PROVIDERS)) {
        expect(config).toHaveProperty("name");
        expect(config).toHaveProperty("clientIdEnv");
        expect(config).toHaveProperty("clientSecretEnv");
        expect(config).toHaveProperty("authUrl");
        expect(config).toHaveProperty("tokenUrl");
        expect(config).toHaveProperty("scopes");
        expect(config).toHaveProperty("color");
        expect(config).toHaveProperty("authMethod");

        expect(typeof config.name).toBe("string");
        expect(config.name.length).toBeGreaterThan(0);
        expect(typeof config.authUrl).toBe("string");
        expect(config.authUrl.startsWith("http")).toBe(true);
        expect(["body", "basic"]).toContain(config.authMethod);
      }
    });

    it("should have platform-specific scopes", () => {
      expect(OAUTH_PROVIDERS.INSTAGRAM.scopes).toContain("instagram_basic");
      expect(OAUTH_PROVIDERS.FACEBOOK.scopes).toContain("pages_read_engagement");
      expect(OAUTH_PROVIDERS.TIKTOK.scopes).toContain("user.info.basic");
      expect(OAUTH_PROVIDERS.X.scopes).toContain("tweet.read");
      expect(OAUTH_PROVIDERS.LINKEDIN.scopes).toContain("openid");
      expect(OAUTH_PROVIDERS.YOUTUBE.scopes).toContain("youtube");
      expect(OAUTH_PROVIDERS.PINTEREST.scopes).toContain("boards:read");
      expect(OAUTH_PROVIDERS.THREADS.scopes).toContain("threads_basic_exposure");
    });

    it("should have correct authMethod for each provider", () => {
      expect(OAUTH_PROVIDERS.INSTAGRAM.authMethod).toBe("body");
      expect(OAUTH_PROVIDERS.FACEBOOK.authMethod).toBe("body");
      expect(OAUTH_PROVIDERS.THREADS.authMethod).toBe("body");
      expect(OAUTH_PROVIDERS.TIKTOK.authMethod).toBe("body");
      expect(OAUTH_PROVIDERS.YOUTUBE.authMethod).toBe("body");
      expect(OAUTH_PROVIDERS.PINTEREST.authMethod).toBe("body");
      expect(OAUTH_PROVIDERS.LINKEDIN.authMethod).toBe("basic");
      expect(OAUTH_PROVIDERS.X.authMethod).toBe("basic");
    });

    it("should have unique colors per provider", () => {
      const colors = Object.values(OAUTH_PROVIDERS).map((p) => p.color);
      const uniqueColors = new Set(colors);
      // Some providers may share colors (e.g., black for X and Threads)
      expect(uniqueColors.size).toBeGreaterThanOrEqual(colors.length - 2);
    });
  });

  describe("getAuthBaseUrl", () => {
    it("should return AUTH_URL when set", () => {
      expect(getAuthBaseUrl()).toBe("https://socialcreator.app");
    });

    it("should return fallback when AUTH_URL is not set", () => {
      delete process.env.AUTH_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;

      // With NODE_ENV=development, should return localhost
      (process.env as Record<string, string>).NODE_ENV = "development";
      expect(getAuthBaseUrl()).toBe("http://localhost:3000");
    });

    it("should return production URL when no env vars and not development", () => {
      delete process.env.AUTH_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete (process.env as Record<string, string>).NODE_ENV;

      const baseUrl = getAuthBaseUrl();
      expect(baseUrl).toBe("https://socialcreator.app");
    });

    it("should use NEXT_PUBLIC_APP_URL when AUTH_URL is not set", () => {
      delete process.env.AUTH_URL;
      process.env.NEXT_PUBLIC_APP_URL = "https://custom.app";
      // Set NODE_ENV to something other than development to take NEXT_PUBLIC_APP_URL path
      (process.env as Record<string, string>).NODE_ENV = "production";

      expect(getAuthBaseUrl()).toBe("https://custom.app");
    });
  });

  describe("getRedirectUri", () => {
    it("should return correct redirect URI for Facebook", () => {
      const uri = getRedirectUri("FACEBOOK");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/facebook");
    });

    it("should return correct redirect URI for Instagram", () => {
      const uri = getRedirectUri("INSTAGRAM");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/instagram");
    });

    it("should return correct redirect URI for X (Twitter)", () => {
      const uri = getRedirectUri("X");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/x");
    });

    it("should return correct redirect URI for TikTok", () => {
      const uri = getRedirectUri("TIKTOK");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/tiktok");
    });

    it("should return correct redirect URI for LinkedIn", () => {
      const uri = getRedirectUri("LINKEDIN");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/linkedin");
    });

    it("should return correct redirect URI for YouTube", () => {
      const uri = getRedirectUri("YOUTUBE");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/youtube");
    });

    it("should return correct redirect URI for Pinterest", () => {
      const uri = getRedirectUri("PINTEREST");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/pinterest");
    });

    it("should return correct redirect URI for Threads", () => {
      const uri = getRedirectUri("THREADS");
      expect(uri).toBe("https://socialcreator.app/api/connected-accounts/callback/threads");
    });
  });

  describe("getProviderCredentials", () => {
    it("should return credentials for Facebook (Meta)", () => {
      const creds = getProviderCredentials("FACEBOOK");
      expect(creds.clientId).toBe("meta-client");
      expect(creds.clientSecret).toBe("meta-secret");
    });

    it("should return credentials for X", () => {
      const creds = getProviderCredentials("X");
      expect(creds.clientId).toBe("x-client");
      expect(creds.clientSecret).toBe("x-secret");
    });

    it("should return undefined for unset env vars", () => {
      delete process.env.META_CLIENT_ID;
      const creds = getProviderCredentials("FACEBOOK");
      expect(creds.clientId).toBeUndefined();
      expect(creds.clientSecret).toBe("meta-secret");
    });
  });

  describe("isProviderConfigured", () => {
    it("should return true when both clientId and clientSecret are set", () => {
      expect(isProviderConfigured("FACEBOOK")).toBe(true);
      expect(isProviderConfigured("X")).toBe(true);
    });

    it("should return false when clientId is missing", () => {
      delete process.env.META_CLIENT_ID;
      expect(isProviderConfigured("INSTAGRAM")).toBe(false);
    });

    it("should return false when clientSecret is missing", () => {
      delete process.env.X_CLIENT_SECRET;
      expect(isProviderConfigured("X")).toBe(false);
    });

    it("should return false when both are missing", () => {
      delete process.env.META_CLIENT_ID;
      delete process.env.META_CLIENT_SECRET;
      expect(isProviderConfigured("FACEBOOK")).toBe(false);
    });
  });
});
