/**
 * Profile Store
 * Profiles list, selection, CRUD
 * selectedProfileId persisted to localStorage
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Profile {
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

export interface ProfileState {
  profiles: Profile[];
  selectedProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  selectedProfile: () => Profile | null;
  fetchProfiles: () => Promise<void>;
  selectProfile: (id: string | null) => void;
  createProfile: (data: { name: string; brandVoice: string }) => Promise<Profile>;
  updateProfile: (id: string, data: Partial<Profile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      selectedProfileId: null,
      isLoading: false,
      error: null,

      selectedProfile: () => {
        const { profiles, selectedProfileId } = get();
        return profiles.find((p) => p.id === selectedProfileId) ?? null;
      },

      fetchProfiles: async () => {
        set({ isLoading: true, error: null });

        try {
          const res = await fetch("/api/v1/profiles");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          set({ profiles: data.profiles ?? data, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to fetch profiles",
            isLoading: false,
          });
        }
      },

      selectProfile: (id) => set({ selectedProfileId: id }),

      createProfile: async (data) => {
        set({ isLoading: true });

        try {
          const res = await fetch("/api/v1/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const profile = await res.json();
          set((state) => ({
            profiles: [profile, ...state.profiles],
            selectedProfileId: profile.id,
            isLoading: false,
          }));

          return profile;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to create profile",
          });
          throw err;
        }
      },

      updateProfile: async (id, data) => {
        try {
          const res = await fetch(`/api/v1/profiles/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const updated = await res.json();
          set((state) => ({
            profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...updated } : p)),
          }));
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to update profile",
          });
        }
      },

      deleteProfile: async (id) => {
        try {
          const res = await fetch(`/api/v1/profiles/${id}`, {
            method: "DELETE",
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          set((state) => ({
            profiles: state.profiles.filter((p) => p.id !== id),
            selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId,
          }));
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to delete profile",
          });
        }
      },

      reset: () => set({ profiles: [], selectedProfileId: null, error: null }),
    }),
    {
      name: "sc-profile-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedProfileId: state.selectedProfileId,
      }),
    },
  ),
);
