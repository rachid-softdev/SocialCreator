/**
 * Auth Store
 * User session, login/logout, user profile
 * Persisted to localStorage
 *
 * SECURITY NOTE: User profile data (id, email, name, role) is persisted to
 * localStorage, which is accessible to any JavaScript on the same origin.
 * Only non-sensitive profile metadata is stored; the actual auth session
 * is managed server-side via NextAuth. The store MUST re-verify auth state
 * on rehydration rather than trusting persisted data.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
      clearUser: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "sc-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AuthState>),
        isAuthenticated: !!(persisted as AuthState)?.user,
        // Always set loading true on rehydration; let syncAuthSession() verify real auth state
        isLoading: true,
      }),
    },
  ),
);

/**
 * Sync the current auth session from NextAuth into the store.
 *
 * Reads the session from the standard NextAuth HTTP endpoint so this module
 * stays client-safe (importing `@/lib/auth` would pull server-only code —
 * pino/async_hooks — into client bundles).
 */
export async function syncAuthSession(): Promise<void> {
  try {
    const res = await fetch("/api/auth/session");
    const session = await res.json();

    if (session?.user?.id) {
      useAuthStore.getState().setUser({
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.name || null,
        image: session.user.image || null,
        role: (session.user as any)?.role || "USER",
      });
    } else {
      useAuthStore.getState().setLoading(false);
    }
  } catch {
    useAuthStore.getState().setLoading(false);
  }
}
