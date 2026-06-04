/**
 * Tests for profile store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { mockLocalStorage } from "@/lib/__tests__/__shared__/mock-factory";
import { mockProfile } from "@/lib/__tests__/__shared__/test-fixtures";
import { useProfileStore as useRealProfileStore } from "@/lib/stores/profile-store";

// ========== Inline types and store matching the design spec ==========

interface Profile {
  id: string;
  name: string;
  brandVoice: string;
  platforms: string[];
  avatarUrl: string | null;
  isActive: boolean;
  teamId: string | null;
  connectedAccountCount: number;
  agentCount: number;
}

interface ProfileState {
  profiles: Profile[];
  selectedProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  selectedProfile: () => Profile | null;
  selectProfile: (id: string | null) => void;
  reset: () => void;
}

const useProfileStore = create<ProfileState>()((set, get) => ({
  profiles: [],
  selectedProfileId: null,
  isLoading: false,
  error: null,
  selectedProfile: () => get().profiles.find((p) => p.id === get().selectedProfileId) ?? null,
  selectProfile: (id) => set({ selectedProfileId: id }),
  reset: () => set({ profiles: [], selectedProfileId: null, error: null }),
}));

// ========== Tests ==========

describe("ProfileStore", () => {
  const mockProfile: Profile = {
    id: "profile-1",
    name: "Brand Profile",
    brandVoice: "Professional and engaging",
    platforms: ["X", "LINKEDIN"],
    avatarUrl: "https://example.com/avatar.png",
    isActive: true,
    teamId: null,
    connectedAccountCount: 2,
    agentCount: 3,
  };

  const mockProfile2: Profile = {
    ...mockProfile,
    id: "profile-2",
    name: "Personal Profile",
    brandVoice: "Casual and fun",
    platforms: ["INSTAGRAM"],
    isActive: false,
    connectedAccountCount: 1,
    agentCount: 0,
  };

  beforeEach(() => {
    useProfileStore.setState({
      profiles: [],
      selectedProfileId: null,
      isLoading: false,
      error: null,
    });
  });

  describe("initial state", () => {
    it("should start with empty profiles", () => {
      expect(useProfileStore.getState().profiles).toStrictEqual([]);
    });

    it("should start with no selected profile", () => {
      expect(useProfileStore.getState().selectedProfileId).toBeNull();
    });

    it("should start with not loading", () => {
      expect(useProfileStore.getState().isLoading).toBe(false);
    });

    it("should start with no error", () => {
      expect(useProfileStore.getState().error).toBeNull();
    });
  });

  describe("selectProfile", () => {
    it("should set selectedProfileId", () => {
      useProfileStore.getState().selectProfile("profile-1");
      expect(useProfileStore.getState().selectedProfileId).toBe("profile-1");
    });

    it("should clear selection when given null", () => {
      useProfileStore.setState({ selectedProfileId: "profile-1" });
      useProfileStore.getState().selectProfile(null);

      expect(useProfileStore.getState().selectedProfileId).toBeNull();
    });
  });

  describe("selectedProfile derived state", () => {
    it("should return the profile matching selectedProfileId", () => {
      useProfileStore.setState({
        profiles: [mockProfile, mockProfile2],
        selectedProfileId: "profile-1",
      });

      const selected = useProfileStore.getState().selectedProfile();
      expect(selected).toStrictEqual(mockProfile);
    });

    it("should return null when no profile is selected", () => {
      useProfileStore.setState({ profiles: [mockProfile, mockProfile2] });

      const selected = useProfileStore.getState().selectedProfile();
      expect(selected).toBeNull();
    });

    it("should return null when selectedProfileId doesn't match any profile", () => {
      useProfileStore.setState({
        profiles: [mockProfile],
        selectedProfileId: "nonexistent",
      });

      const selected = useProfileStore.getState().selectedProfile();
      expect(selected).toBeNull();
    });

    it("should update when profiles or selection changes", () => {
      useProfileStore.setState({
        profiles: [mockProfile],
        selectedProfileId: "profile-1",
      });
      expect(useProfileStore.getState().selectedProfile()?.name).toBe("Brand Profile");

      useProfileStore.setState({ selectedProfileId: null });
      expect(useProfileStore.getState().selectedProfile()).toBeNull();
    });

    it("should handle switching between profiles", () => {
      useProfileStore.setState({
        profiles: [mockProfile, mockProfile2],
        selectedProfileId: "profile-1",
      });
      expect(useProfileStore.getState().selectedProfile()?.name).toBe("Brand Profile");

      useProfileStore.getState().selectProfile("profile-2");
      expect(useProfileStore.getState().selectedProfile()?.name).toBe("Personal Profile");
    });
  });

  describe("profiles array management", () => {
    it("should handle multiple profiles", () => {
      useProfileStore.setState({ profiles: [mockProfile, mockProfile2] });
      expect(useProfileStore.getState().profiles).toHaveLength(2);
    });

    it("should handle empty profile list", () => {
      expect(useProfileStore.getState().profiles).toStrictEqual([]);
    });
  });

  describe("reset", () => {
    it("should clear all state to defaults", () => {
      useProfileStore.setState({
        profiles: [mockProfile, mockProfile2],
        selectedProfileId: "profile-1",
        error: "some error",
      });

      useProfileStore.getState().reset();

      const state = useProfileStore.getState();
      expect(state.profiles).toStrictEqual([]);
      expect(state.selectedProfileId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("error state", () => {
    it("should start as null", () => {
      expect(useProfileStore.getState().error).toBeNull();
    });

    it("should be resettable", () => {
      useProfileStore.setState({ error: "Failed to load" });
      useProfileStore.getState().reset();

      expect(useProfileStore.getState().error).toBeNull();
    });
  });
});

// ========== Import-based tests: async operations & persist ==========

describe("profile-store [integration] — fetchProfiles, CRUD, persist", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    useRealProfileStore.setState({
      profiles: [],
      selectedProfileId: null,
      isLoading: false,
      error: null,
    });
    globalThis.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("fetchProfiles", () => {
    it("fetches and sets profiles on success", async () => {
      const profiles = [mockProfile];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profiles }),
      });

      await useRealProfileStore.getState().fetchProfiles();

      expect(useRealProfileStore.getState().profiles).toStrictEqual(profiles);
      expect(useRealProfileStore.getState().isLoading).toBe(false);
    });

    it("sets error on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await useRealProfileStore.getState().fetchProfiles();

      expect(useRealProfileStore.getState().error).toBe("HTTP 500");
      expect(useRealProfileStore.getState().isLoading).toBe(false);
    });

    it("calls GET /api/v1/profiles", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profiles: [] }),
      });

      await useRealProfileStore.getState().fetchProfiles();

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/profiles");
    });
  });

  describe("createProfile", () => {
    it("creates profile and auto-selects it", async () => {
      const newProfile = { ...mockProfile, id: "profile-new" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newProfile),
      });

      const result = await useRealProfileStore
        .getState()
        .createProfile({ name: "New Profile", brandVoice: "Fun" });

      expect(result).toMatchObject(newProfile);
      expect(useRealProfileStore.getState().profiles[0]).toMatchObject(newProfile);
      expect(useRealProfileStore.getState().selectedProfileId).toBe("profile-new");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/profiles",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Profile", brandVoice: "Fun" }),
        }),
      );
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(
        useRealProfileStore.getState().createProfile({ name: "Bad", brandVoice: "" }),
      ).rejects.toThrow("HTTP 400");
    });
  });

  describe("updateProfile", () => {
    it("sends PATCH and updates local state", async () => {
      useRealProfileStore.setState({ profiles: [mockProfile] });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: "Updated Name" }),
      });

      await useRealProfileStore.getState().updateProfile("profile-1", { name: "Updated Name" });

      expect(useRealProfileStore.getState().profiles[0].name).toBe("Updated Name");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/profiles/profile-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("deleteProfile", () => {
    it("sends DELETE and removes profile", async () => {
      useRealProfileStore.setState({
        profiles: [mockProfile],
        selectedProfileId: "profile-1",
      });
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await useRealProfileStore.getState().deleteProfile("profile-1");

      expect(useRealProfileStore.getState().profiles).toStrictEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/profiles/profile-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("clears selectedProfileId if deleted profile was selected", async () => {
      useRealProfileStore.setState({
        profiles: [mockProfile, { ...mockProfile, id: "profile-2" }],
        selectedProfileId: "profile-1",
      });
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await useRealProfileStore.getState().deleteProfile("profile-1");

      expect(useRealProfileStore.getState().selectedProfileId).toBeNull();
    });

    it("preserves selectedProfileId if other profile deleted", async () => {
      const otherProfile = { ...mockProfile, id: "profile-2" };
      useRealProfileStore.setState({
        profiles: [mockProfile, otherProfile],
        selectedProfileId: "profile-2",
      });
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await useRealProfileStore.getState().deleteProfile("profile-1");

      expect(useRealProfileStore.getState().selectedProfileId).toBe("profile-2");
    });
  });

  describe("persist middleware", () => {
    it("partialize only stores selectedProfileId", async () => {
      // Fresh store instance so localStorage is mocked before createJSONStorage evaluates
      const { store: lsStore } = mockLocalStorage();
      vi.resetModules();
      const { useProfileStore: persistStore } = await import("@/lib/stores/profile-store");

      persistStore.getState().selectProfile("profile-1");

      const storedRaw = lsStore.get("sc-profile-storage");
      expect(storedRaw).not.toBeNull();

      const parsed = JSON.parse(storedRaw as string);
      expect(parsed.state).toHaveProperty("selectedProfileId", "profile-1");
      expect(parsed.state).not.toHaveProperty("profiles");
      expect(parsed.state).not.toHaveProperty("isLoading");
    });
  });
});
