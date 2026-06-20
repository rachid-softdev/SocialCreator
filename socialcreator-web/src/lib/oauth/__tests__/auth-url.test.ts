/**
 * Tests for OAuth Auth URL module
 * Tests state generation, PKCE, and authorization URL building
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthUrl,
  buildAuthUrlWithParams,
  generatePKCEChallenge,
  generatePKCEVerifier,
  generateState,
  parseState,
} from "../auth-url";

describe("OAuth Auth URL", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Set required env vars for auth URL building
    process.env.META_CLIENT_ID = "meta-client-123";
    process.env.META_CLIENT_SECRET = "meta-secret";
    process.env.GOOGLE_CLIENT_ID = "google-client-456";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.X_CLIENT_ID = "x-client-789";
    process.env.X_CLIENT_SECRET = "x-secret";
    process.env.LINKEDIN_CLIENT_ID = "li-client-012";
    process.env.LINKEDIN_CLIENT_SECRET = "li-secret";
    process.env.TIKTOK_CLIENT_KEY = "tt-client-345";
    process.env.TIKTOK_CLIENT_SECRET = "tt-secret";
    process.env.PINTEREST_CLIENT_ID = "pin-client-678";
    process.env.PINTEREST_CLIENT_SECRET = "pin-secret";
    process.env.AUTH_URL = "https://socialcreator.app";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateState / parseState", () => {
    it("should generate and parse a state parameter", () => {
      const state = generateState("FACEBOOK", "profile-1");
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);

      const parsed = parseState(state);
      expect(parsed).not.toBeNull();
      expect(parsed?.platform).toBe("FACEBOOK");
      expect(parsed?.profileId).toBe("profile-1");
      expect(parsed?.timestamp).toBeGreaterThan(0);
    });

    it("should include codeVerifier when provided", () => {
      const state = generateState("X", "profile-2", "my-verifier");
      const parsed = parseState(state);
      expect(parsed).not.toBeNull();
      expect(parsed?.codeVerifier).toBe("my-verifier");
    });

    it("should return null for tampered state (decryption fails)", () => {
      const parsed = parseState("tampered:state:string");
      expect(parsed).toBeNull();
    });

    it("should return null for expired state (older than 10 minutes)", () => {
      // Generate a state
      const state = generateState("FACEBOOK", "profile-1");

      // Advance time by 11 minutes
      vi.useFakeTimers();
      vi.advanceTimersByTime(11 * 60 * 1000);

      const parsed = parseState(state);
      expect(parsed).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("generatePKCEVerifier", () => {
    it("should generate a base64url string without padding", () => {
      const verifier = generatePKCEVerifier();
      expect(typeof verifier).toBe("string");
      expect(verifier.length).toBeGreaterThan(0);
      // No padding characters
      expect(verifier).not.toContain("=");
      // No plus or forward slash (base64url)
      expect(verifier).not.toContain("+");
      expect(verifier).not.toContain("/");
    });

    it("should generate different verifiers each time", () => {
      const v1 = generatePKCEVerifier();
      const v2 = generatePKCEVerifier();
      expect(v1).not.toBe(v2);
    });
  });

  describe("generatePKCEChallenge", () => {
    it("should generate a base64url-encoded SHA-256 hash", () => {
      const verifier = "test-verifier-string-12345";
      const challenge = generatePKCEChallenge(verifier);
      expect(typeof challenge).toBe("string");
      expect(challenge.length).toBeGreaterThan(0);
      // No padding
      expect(challenge).not.toContain("=");
      // Base64url encoding
      expect(challenge).not.toContain("+");
      expect(challenge).not.toContain("/");
    });

    it("should generate deterministic results for the same input", () => {
      const verifier = "consistent-verifier";
      const c1 = generatePKCEChallenge(verifier);
      const c2 = generatePKCEChallenge(verifier);
      expect(c1).toBe(c2);
    });

    it("should generate different results for different inputs", () => {
      const c1 = generatePKCEChallenge("verifier-1");
      const c2 = generatePKCEChallenge("verifier-2");
      expect(c1).not.toBe(c2);
    });
  });

  describe("buildAuthUrl", () => {
    it("should build a valid Facebook OAuth URL", () => {
      const url = buildAuthUrl("FACEBOOK", "profile-1");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.facebook.com");
      expect(parsed.pathname).toBe("/v18.0/dialog/oauth");
      expect(parsed.searchParams.get("client_id")).toBe("meta-client-123");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://socialcreator.app/api/connected-accounts/callback/facebook",
      );
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("scope")).toBeTruthy();
      expect(parsed.searchParams.get("state")).toBeTruthy();
    });

    it("should build a valid X (Twitter) URL with PKCE parameters", () => {
      const url = buildAuthUrl("X", "profile-x");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://twitter.com");
      expect(parsed.pathname).toBe("/i/oauth2/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("x-client-789");
      expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(parsed.searchParams.get("state")).toBeTruthy();
    });

    it("should build a valid YouTube OAuth URL", () => {
      const url = buildAuthUrl("YOUTUBE", "profile-yt");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://accounts.google.com");
      expect(parsed.searchParams.get("client_id")).toBe("google-client-456");
      expect(parsed.searchParams.get("scope")).toContain("youtube");
    });

    it("should build a valid LinkedIn OAuth URL", () => {
      const url = buildAuthUrl("LINKEDIN", "profile-li");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.linkedin.com");
      expect(parsed.searchParams.get("client_id")).toBe("li-client-012");
    });

    it("should build a valid Instagram URL (Meta)", () => {
      const url = buildAuthUrl("INSTAGRAM", "profile-ig");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.facebook.com");
      expect(parsed.searchParams.get("client_id")).toBe("meta-client-123");
      expect(parsed.searchParams.get("scope")).toContain("instagram_basic");
    });

    it("should include the state parameter as an encrypted token", () => {
      const url = buildAuthUrl("FACEBOOK", "profile-1");
      const parsed = new URL(url);
      const stateParam = parsed.searchParams.get("state") ?? "";

      // State should be an AES-256-GCM encrypted string (iv:tag:ciphertext format)
      expect(stateParam).toContain(":");

      // Should be parseable
      const state = parseState(stateParam);
      expect(state).not.toBeNull();
      expect(state?.platform).toBe("FACEBOOK");
      expect(state?.profileId).toBe("profile-1");
    });

    it("should use correct redirect URI format per platform", () => {
      const url = buildAuthUrl("INSTAGRAM", "p1");
      const parsed = new URL(url);
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://socialcreator.app/api/connected-accounts/callback/instagram",
      );
    });

    it("should handle empty client_id when env var is missing", () => {
      delete process.env.META_CLIENT_ID;
      const url = buildAuthUrl("FACEBOOK", "p1");
      const parsed = new URL(url);
      expect(parsed.searchParams.get("client_id")).toBe("");
    });

    it("should build a valid TikTok OAuth URL", () => {
      const url = buildAuthUrl("TIKTOK", "profile-tt");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.tiktok.com");
      expect(parsed.pathname).toBe("/auth/authorize/");
      expect(parsed.searchParams.get("client_id")).toBe("tt-client-345");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://socialcreator.app/api/connected-accounts/callback/tiktok",
      );
      expect(parsed.searchParams.get("scope")).toContain("user.info.basic");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("state")).toBeTruthy();
    });

    it("should build a valid Pinterest OAuth URL", () => {
      const url = buildAuthUrl("PINTEREST", "profile-pin");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.pinterest.com");
      expect(parsed.pathname).toBe("/oauth/");
      expect(parsed.searchParams.get("client_id")).toBe("pin-client-678");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://socialcreator.app/api/connected-accounts/callback/pinterest",
      );
      expect(parsed.searchParams.get("scope")).toContain("boards:read");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("state")).toBeTruthy();
    });

    it("should build a valid Threads OAuth URL (Meta)", () => {
      const url = buildAuthUrl("THREADS", "profile-threads");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://www.facebook.com");
      expect(parsed.pathname).toBe("/v18.0/dialog/oauth");
      expect(parsed.searchParams.get("client_id")).toBe("meta-client-123");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://socialcreator.app/api/connected-accounts/callback/threads",
      );
      expect(parsed.searchParams.get("scope")).toContain("threads_basic_exposure");
    });

    it("should build URLs for all 8 providers without throwing", () => {
      const providers = [
        "INSTAGRAM",
        "FACEBOOK",
        "TIKTOK",
        "LINKEDIN",
        "X",
        "YOUTUBE",
        "PINTEREST",
        "THREADS",
      ];
      for (const provider of providers) {
        const url = buildAuthUrl(provider as any, `profile-${provider.toLowerCase()}`);
        expect(() => new URL(url)).not.toThrow();
        expect(url.startsWith("http")).toBe(true);
      }
    });

    it("should include state with codeVerifier in X auth URL", () => {
      const url = buildAuthUrl("X", "profile-x-pkce");
      const parsed = new URL(url);

      const stateParam = parsed.searchParams.get("state") ?? "";
      // State should contain PKCE code verifier when platform is X
      const parsedState = parseState(stateParam);
      expect(parsedState).not.toBeNull();
      expect(parsedState?.codeVerifier).toBeTruthy();
      expect(typeof parsedState?.codeVerifier).toBe("string");
    });

    it("should not include codeVerifier for non-X platforms", () => {
      const url = buildAuthUrl("FACEBOOK", "profile-fb");
      const parsed = new URL(url);

      const stateParam = parsed.searchParams.get("state") ?? "";
      const parsedState = parseState(stateParam);
      expect(parsedState).not.toBeNull();
      expect(parsedState?.codeVerifier).toBeUndefined();
    });

    it("should set redirect_uri for LinkedIn", () => {
      const url = buildAuthUrl("LINKEDIN", "profile-li");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://socialcreator.app/api/connected-accounts/callback/linkedin",
      );
    });
  });

  describe("buildAuthUrlWithParams", () => {
    it("should append additional query parameters", () => {
      const url = buildAuthUrlWithParams("FACEBOOK", "profile-1", {
        extra_param: "value1",
        another: "value2",
      });
      const parsed = new URL(url);

      expect(parsed.searchParams.get("extra_param")).toBe("value1");
      expect(parsed.searchParams.get("another")).toBe("value2");
    });

    it("should still contain base auth parameters", () => {
      const url = buildAuthUrlWithParams("FACEBOOK", "profile-1", {
        extra: "param",
      });
      const parsed = new URL(url);

      expect(parsed.searchParams.get("client_id")).toBe("meta-client-123");
      expect(parsed.searchParams.get("state")).toBeTruthy();
    });

    it("should handle empty additional params gracefully", () => {
      const url = buildAuthUrlWithParams("FACEBOOK", "profile-1");
      const parsed = new URL(url);
      // Should not throw, valid URL
      expect(parsed.searchParams.get("client_id")).toBe("meta-client-123");
    });
  });
});
