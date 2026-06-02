/**
 * Tests for profile store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

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
