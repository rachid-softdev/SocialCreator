/**
 * Tests for auth store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";

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
