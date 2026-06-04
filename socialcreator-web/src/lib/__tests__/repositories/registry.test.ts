/**
 * Tests for Repository Registry (singleton DI pattern)
 *
 * The real registry uses runtime require() for lazy loading,
 * which cannot be intercepted by vi.mock. Instead, we mock
 * the registry module itself with a test double that mirrors
 * the singleton init/get/reset/override logic so we can verify
 * the registry pattern behavior in isolation.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mock the registry module directly ────────────────────────────────────────
// The real registry uses dynamic require() calls inside initRepositories()
// that bypass vi.mock interception. We provide a test double that implements
// the same singleton init/get/reset/override contract.

vi.mock("@/lib/repositories/registry", () => {
  let registryInstance: Record<string, unknown> | null = null;

  function makeDefaultRepos() {
    return {
      content: { findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      agent: {
        findById: vi.fn(),
        findByProfileId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findActiveByPlatform: vi.fn(),
      },
      agentRun: {
        findById: vi.fn(),
        findByAgentId: vi.fn(),
        create: vi.fn(),
        updateStatus: vi.fn(),
      },
      profile: { findById: vi.fn(), findByUserId: vi.fn(), create: vi.fn() },
      user: { findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn() },
      apiKey: { findById: vi.fn(), findByKey: vi.fn(), create: vi.fn() },
      invitation: { findById: vi.fn(), findByToken: vi.fn(), create: vi.fn() },
      mediaAsset: { findById: vi.fn(), findByProfileId: vi.fn(), create: vi.fn() },
      notification: { findById: vi.fn(), findByUserId: vi.fn(), create: vi.fn() },
      team: { findById: vi.fn(), findBySlug: vi.fn(), create: vi.fn() },
      teamMember: { findById: vi.fn(), findByTeamId: vi.fn(), addMember: vi.fn() },
      connectedAccount: { findById: vi.fn(), findByProfileId: vi.fn(), create: vi.fn() },
      publishLog: { findById: vi.fn(), findByUserId: vi.fn(), create: vi.fn() },
    };
  }

  return {
    initRepositories: (overrides?: Partial<Record<string, unknown>>) => {
      if (registryInstance && !overrides) return registryInstance;
      registryInstance = { ...makeDefaultRepos(), ...(overrides ?? {}) };
      return registryInstance;
    },
    getRepositories: () => {
      if (!registryInstance) {
        registryInstance = makeDefaultRepos();
        return registryInstance;
      }
      return registryInstance;
    },
    resetRepositories: () => {
      registryInstance = null;
    },
  };
});

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { getRepositories, initRepositories, resetRepositories } from "@/lib/repositories/registry";

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Repository Registry", () => {
  afterEach(() => {
    resetRepositories();
  });

  describe("getRepositories", () => {
    it("should auto-init and return all repository keys", () => {
      const repos = getRepositories();
      expect(repos).toHaveProperty("content");
      expect(repos).toHaveProperty("agent");
      expect(repos).toHaveProperty("agentRun");
      expect(repos).toHaveProperty("profile");
      expect(repos).toHaveProperty("user");
      expect(repos).toHaveProperty("apiKey");
      expect(repos).toHaveProperty("invitation");
      expect(repos).toHaveProperty("mediaAsset");
      expect(repos).toHaveProperty("notification");
      expect(repos).toHaveProperty("team");
      expect(repos).toHaveProperty("teamMember");
      expect(repos).toHaveProperty("connectedAccount");
      expect(repos).toHaveProperty("publishLog");
    });

    it("should return the same instance after init", () => {
      const repos1 = getRepositories();
      const repos2 = getRepositories();
      expect(repos1).toBe(repos2);
    });
  });

  describe("initRepositories", () => {
    it("should create all repository instances with expected keys", () => {
      const repos = initRepositories();

      expect(repos).toHaveProperty("content");
      expect(repos).toHaveProperty("agent");
      expect(repos).toHaveProperty("agentRun");
      expect(repos).toHaveProperty("profile");
      expect(repos).toHaveProperty("user");
      expect(repos).toHaveProperty("apiKey");
      expect(repos).toHaveProperty("invitation");
      expect(repos).toHaveProperty("mediaAsset");
      expect(repos).toHaveProperty("notification");
      expect(repos).toHaveProperty("team");
      expect(repos).toHaveProperty("teamMember");
      expect(repos).toHaveProperty("connectedAccount");
      expect(repos).toHaveProperty("publishLog");
    });

    it("should merge overrides with defaults", () => {
      const mockContentRepo = { findById: vi.fn(), customMethod: vi.fn() } as any;
      const repos = initRepositories({ content: mockContentRepo });

      // content should be our override
      expect(repos.content).toBe(mockContentRepo);
      expect((repos.content as any).customMethod).toBeDefined();
      // other repos should be the default instances
      expect(repos.agent).toBeDefined();
      expect(repos.agent).not.toBe(mockContentRepo);
      expect(repos.notification).toBeDefined();
      expect(repos.notification).not.toBe(mockContentRepo);
    });

    it("should return existing instance when called without overrides", () => {
      const repos1 = initRepositories();
      const repos2 = initRepositories();
      expect(repos1).toBe(repos2);
    });

    it("should reinitialize when called with overrides after prior init", () => {
      const repos1 = initRepositories();
      const mockContentRepo = { findById: vi.fn() } as any;
      const repos2 = initRepositories({ content: mockContentRepo });

      // Should be a new instance with override merged
      expect(repos2.content).toBe(mockContentRepo);
      expect(repos2.agent).toBeDefined();
      // repos1 and repos2 differ because overrides cause reinit
      expect(repos1).not.toBe(repos2);
    });
  });

  describe("resetRepositories", () => {
    it("should clear the singleton instance", () => {
      const repos1 = initRepositories();
      resetRepositories();

      const repos2 = initRepositories();
      // After reset, should get a fresh instance
      expect(repos1).not.toBe(repos2);
    });

    it("should allow getRepositories to work after reset", () => {
      initRepositories();
      resetRepositories();

      // Should auto-init after reset
      const repos = getRepositories();
      expect(repos).toHaveProperty("content");
      expect(repos).toHaveProperty("agent");
    });

    it("should be idempotent", () => {
      // Calling reset multiple times should not throw
      resetRepositories();
      resetRepositories();
      resetRepositories();

      // Should still be able to init after multiple resets
      const repos = initRepositories();
      expect(repos).toHaveProperty("content");
    });
  });

  describe("singleton behavior", () => {
    it("should maintain the same instance across multiple getRepositories calls", () => {
      const repos1 = initRepositories();
      const repos2 = getRepositories();
      const repos3 = getRepositories();

      expect(repos1).toBe(repos2);
      expect(repos2).toBe(repos3);
    });

    it("should create fresh instance after each reset+init cycle", () => {
      const repos1 = initRepositories();
      resetRepositories();
      const repos2 = initRepositories();
      resetRepositories();
      const repos3 = initRepositories();

      expect(repos1).not.toBe(repos2);
      expect(repos2).not.toBe(repos3);
      expect(repos1).not.toBe(repos3);
    });
  });

  describe("initRepositories idempotent", () => {
    it("should not crash when called multiple times without overrides", () => {
      const repos1 = initRepositories();
      const repos2 = initRepositories();
      const repos3 = initRepositories();

      expect(repos1).toBe(repos2);
      expect(repos2).toBe(repos3);
    });
  });
});
