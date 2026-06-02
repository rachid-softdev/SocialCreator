/**
 * UI Store
 * Sidebar, theme, modals, toasts
 * Theme + sidebar persisted to localStorage
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type SidebarState = "open" | "collapsed";

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

export interface UIState {
  sidebar: SidebarState;
  theme: Theme;
  toasts: Toast[];
  activeModal: string | null;
  modalData: unknown;
  toggleSidebar: () => void;
  setSidebar: (state: SidebarState) => void;
  setTheme: (theme: Theme) => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  openModal: (name: string, data?: unknown) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebar: "open",
      theme: "system",
      toasts: [],
      activeModal: null,
      modalData: null,

      toggleSidebar: () =>
        set((state) => ({
          sidebar: state.sidebar === "open" ? "collapsed" : "open",
        })),

      setSidebar: (sidebar) => set({ sidebar }),

      setTheme: (theme) => set({ theme }),

      addToast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      openModal: (name, data) => set({ activeModal: name, modalData: data }),

      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    {
      name: "sc-ui-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebar: state.sidebar,
      }),
    },
  ),
);
