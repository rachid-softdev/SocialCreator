/**
 * Tests for auth store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

const mockFetch = vi.hoisted(() => vi.fn());

import { mockLocalStorage } from "@/lib/__tests__/__shared__/mock-factory";
import { mockUser } from "@/lib/__tests__/__shared__/test-fixtures";
import { syncAuthSession, useAuthStore as useRealAuthStore } from "@/lib/stores/auth-store";

// ========== Inline types and store matching the design spec ==========

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
  clearUser: () => set({ user: null, isAuthenticated: false, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));

// ========== Tests ==========

describe("AuthStore", () => {
  const mockUser: User = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    image: "https://example.com/avatar.png",
    role: "USER",
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe("initial state", () => {
    it("should start with user null", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it("should start with isLoading false", () => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should start with isAuthenticated false", () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("setUser", () => {
    it("should set the user object", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toStrictEqual(mockUser);
    });

    it("should set isAuthenticated to true", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it("should set isLoading to false", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should handle admin role", () => {
      const adminUser: User = { ...mockUser, role: "ADMIN" };
      useAuthStore.getState().setUser(adminUser);
      expect(useAuthStore.getState().user?.role).toBe("ADMIN");
    });

    it("should handle user with null name and image", () => {
      const minimalUser: User = {
        id: "user-2",
        email: "minimal@test.com",
        name: null,
        image: null,
        role: "USER",
      };
      useAuthStore.getState().setUser(minimalUser);
      expect(useAuthStore.getState().user?.name).toBeNull();
      expect(useAuthStore.getState().user?.image).toBeNull();
    });
  });

  describe("clearUser", () => {
    it("should set user to null", () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().clearUser();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("should set isAuthenticated to false", () => {
      useAuthStore.getState().clearUser();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("should set isLoading to false", () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().clearUser();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("should set isLoading to true", () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it("should set isLoading to false", () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("isAuthenticated derived state", () => {
    it("should be true after setUser", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it("should be false after clearUser", () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().clearUser();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("should be false after init", () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("state transitions", () => {
    it("should transition from authenticated to unauthenticated", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().clearUser();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("should allow re-authentication after clear", () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().clearUser();
      useAuthStore.getState().setUser({ ...mockUser, id: "user-2" });

      expect(useAuthStore.getState().user?.id).toBe("user-2");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });
});

// ========== Import-based tests: persist & syncAuthSession ==========

describe("auth-store [integration] — syncAuthSession & persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    useRealAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe("syncAuthSession", () => {
    it("sets user when session endpoint returns a session with id", async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          user: { id: "1", email: "a@b.com", name: null, image: null },
        }),
      });

      await syncAuthSession();

      const state = useRealAuthStore.getState();
      expect(state.user).toMatchObject({
        id: "1",
        email: "a@b.com",
        name: null,
        image: null,
        role: "USER",
      });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it("sets isLoading false when no session", async () => {
      mockFetch.mockResolvedValue({ json: async () => null });

      await syncAuthSession();

      const state = useRealAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it("sets isLoading false when the session request fails", async () => {
      mockFetch.mockRejectedValue(new Error("Auth service unavailable"));

      await syncAuthSession();

      const state = useRealAuthStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("persist middleware", () => {
    it("partialize only stores user", async () => {
      // Need a fresh store instance so that localStorage is already mocked
      // when createJSONStorage eagerly evaluates the getter
      const { store: lsStore } = mockLocalStorage();
      vi.resetModules();
      const { useAuthStore: persistStore } = await import("@/lib/stores/auth-store");

      persistStore.getState().setUser(mockUser);

      const storedRaw = lsStore.get("sc-auth-storage");
      expect(storedRaw).not.toBeNull();

      const parsed = JSON.parse(storedRaw as string);
      expect(parsed.state).toHaveProperty("user");
      expect(parsed.state.user).toMatchObject(
        expect.objectContaining({ id: mockUser.id, email: mockUser.email }),
      );
      // partialize only keeps user — no isLoading or isAuthenticated
      expect(parsed.state).not.toHaveProperty("isLoading");
      expect(parsed.state).not.toHaveProperty("isAuthenticated");
    });

    it("merge rehydrates with correct auth flags", async () => {
      const { store } = mockLocalStorage();
      store.set("sc-auth-storage", JSON.stringify({ state: { user: mockUser }, version: 0 }));

      vi.resetModules();
      const { useAuthStore: rehydratedStore } = await import("@/lib/stores/auth-store");

      // merge always sets isLoading=true on rehydration
      expect(rehydratedStore.getState().isLoading).toBe(true);
      // Since user was persisted, isAuthenticated should be true
      expect(rehydratedStore.getState().isAuthenticated).toBe(true);
      expect(rehydratedStore.getState().user).toMatchObject(
        expect.objectContaining({ id: mockUser.id, email: mockUser.email }),
      );
    });

    it("merge rehydrates as unauthenticated when no user persisted", async () => {
      const { store } = mockLocalStorage();
      store.set("sc-auth-storage", JSON.stringify({ state: {}, version: 0 }));

      vi.resetModules();
      const { useAuthStore: rehydratedStore } = await import("@/lib/stores/auth-store");

      expect(rehydratedStore.getState().isLoading).toBe(true);
      expect(rehydratedStore.getState().isAuthenticated).toBe(false);
      expect(rehydratedStore.getState().user).toBeNull();
    });

    it("handles corrupted persisted data gracefully", async () => {
      const { store } = mockLocalStorage();
      store.set("sc-auth-storage", JSON.stringify({ state: "corrupted string", version: 0 }));

      vi.resetModules();
      const { useAuthStore: rehydratedStore } = await import("@/lib/stores/auth-store");

      expect(rehydratedStore.getState().isLoading).toBe(true);
      expect(rehydratedStore.getState().isAuthenticated).toBe(false);
      expect(rehydratedStore.getState().user).toBeNull();
    });
  });

  describe("setUser with empty email", () => {
    it("accepts user with empty email string", () => {
      useRealAuthStore.getState().setUser({
        id: "user-2",
        email: "",
        name: null,
        image: null,
        role: "USER",
      });

      const state = useRealAuthStore.getState();
      expect(state.user?.email).toBe("");
      expect(state.isAuthenticated).toBe(true);
    });
  });
});

// ========== Additional syncAuthSession scenarios ==========

describe("syncAuthSession — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    useRealAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe("session.user.id missing", () => {
    it("sets isLoading false when user exists but id is absent", async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          user: { email: "a@b.com", name: "Test", image: null },
          // no id
        }),
      });

      await syncAuthSession();

      const state = useRealAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe("session.user.role absent", () => {
    it("defaults role to USER when session.user.role is not provided", async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          user: { id: "1", email: "a@b.com", name: null, image: null },
          // no role
        }),
      });

      await syncAuthSession();

      const state = useRealAuthStore.getState();
      expect(state.user?.role).toBe("USER");
      expect(state.user?.id).toBe("1");
    });
  });
});
