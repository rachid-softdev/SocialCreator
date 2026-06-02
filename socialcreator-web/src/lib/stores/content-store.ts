/**
 * Content Store
 * Content list, CRUD operations, filters
 */

import { create } from "zustand";

export interface ContentItem {
  id: string;
  profileId: string;
  platform: string;
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
  status: "DRAFT" | "APPROVED" | "PUBLISHED" | "FAILED" | "REJECTED" | "SCHEDULED";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledPublishAt?: string;
}

export interface ContentFilters {
  profileId?: string;
  status?: string;
  platform?: string;
  page: number;
  pageSize: number;
}

export interface ContentState {
  items: ContentItem[];
  total: number;
  totalPages: number;
  filters: ContentFilters;
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  setFilters: (filters: Partial<ContentFilters>) => void;
  fetchContent: () => Promise<void>;
  addItem: (item: ContentItem) => void;
  updateItem: (id: string, updates: Partial<ContentItem>) => void;
  removeItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: ContentFilters = { page: 1, pageSize: 20 };

export const useContentStore = create<ContentState>()((set, get) => ({
  items: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  selectedId: null,
  isLoading: false,
  error: null,

  setFilters: (partial) => {
    const newFilters = {
      ...get().filters,
      ...partial,
      page: partial.page ?? 1,
    };
    set({ filters: newFilters });
    get().fetchContent();
  },

  fetchContent: async () => {
    set({ isLoading: true, error: null });

    try {
      const { filters } = get();
      const params = new URLSearchParams();

      if (filters.profileId) params.set("profileId", filters.profileId);
      if (filters.status) params.set("status", filters.status);
      if (filters.platform) params.set("platform", filters.platform);
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/v1/content?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      set({
        items: data.contents ?? data,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 0,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch content",
        isLoading: false,
      });
    }
  },

  addItem: (item) => set((state) => ({ items: [item, ...state.items], total: state.total + 1 })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      total: state.total - 1,
    })),

  selectItem: (id) => set({ selectedId: id }),

  reset: () =>
    set({
      items: [],
      total: 0,
      totalPages: 0,
      filters: DEFAULT_FILTERS,
      selectedId: null,
      error: null,
    }),
}));
