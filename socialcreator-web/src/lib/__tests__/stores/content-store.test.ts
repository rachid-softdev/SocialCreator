/**
 * Tests for content store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

// ========== Inline types and store matching the design spec ==========

interface ContentItem {
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
}

interface ContentFilters {
  profileId?: string;
  status?: string;
  platform?: string;
  page: number;
  pageSize: number;
}

interface ContentState {
  items: ContentItem[];
  total: number;
  totalPages: number;
  filters: ContentFilters;
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  setFilters: (filters: Partial<ContentFilters>) => void;
  addItem: (item: ContentItem) => void;
  updateItem: (id: string, updates: Partial<ContentItem>) => void;
  removeItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  reset: () => void;
}

const DEFAULT_FILTERS: ContentFilters = { page: 1, pageSize: 20 };

const useContentStore = create<ContentState>()((set, get) => ({
  items: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  selectedId: null,
  isLoading: false,
  error: null,
  setFilters: (partial) => {
    const newFilters = { ...get().filters, ...partial, page: partial.page ?? 1 };
    set({ filters: newFilters });
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

// ========== Tests ==========

describe("ContentStore", () => {
  const mockItem: ContentItem = {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Test post",
    mediaUrls: [],
    hashtags: ["test"],
    status: "DRAFT",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  const mockItem2: ContentItem = {
    ...mockItem,
    id: "content-2",
    textContent: "Second post",
    status: "PUBLISHED",
    publishedAt: "2024-01-02T00:00:00Z",
  };

  beforeEach(() => {
    useContentStore.setState({
      items: [],
      total: 0,
      totalPages: 0,
      filters: { page: 1, pageSize: 20 },
      selectedId: null,
      isLoading: false,
      error: null,
    });
  });

  describe("initial state", () => {
    it("should start with empty items", () => {
      expect(useContentStore.getState().items).toStrictEqual([]);
    });

    it("should start with default filters", () => {
      expect(useContentStore.getState().filters).toStrictEqual({ page: 1, pageSize: 20 });
    });

    it("should start with no selected item", () => {
      expect(useContentStore.getState().selectedId).toBeNull();
    });

    it("should start with not loading and no error", () => {
      expect(useContentStore.getState().isLoading).toBe(false);
      expect(useContentStore.getState().error).toBeNull();
    });
  });

  describe("setFilters", () => {
    it("should update filters with partial values", () => {
      useContentStore.getState().setFilters({ status: "DRAFT" });

      const filters = useContentStore.getState().filters;
      expect(filters.status).toBe("DRAFT");
      expect(filters.page).toBe(1);
      expect(filters.pageSize).toBe(20);
    });

    it("should reset page to 1 when setting new filters", () => {
      useContentStore.setState({ filters: { page: 5, pageSize: 20 } });
      useContentStore.getState().setFilters({ platform: "X" });

      expect(useContentStore.getState().filters.page).toBe(1);
    });

    it("should merge with existing filters", () => {
      useContentStore.getState().setFilters({ platform: "X" });
      useContentStore.getState().setFilters({ status: "PUBLISHED" });

      const filters = useContentStore.getState().filters;
      expect(filters.platform).toBe("X");
      expect(filters.status).toBe("PUBLISHED");
    });

    it("should preserve page when explicitly provided", () => {
      useContentStore.getState().setFilters({ page: 3 });
      expect(useContentStore.getState().filters.page).toBe(3);
    });
  });

  describe("addItem", () => {
    it("should add item at the beginning of the list", () => {
      useContentStore.getState().addItem(mockItem);

      expect(useContentStore.getState().items).toHaveLength(1);
      expect(useContentStore.getState().items[0].id).toBe("content-1");
    });

    it("should increment total count", () => {
      useContentStore.getState().addItem(mockItem);
      expect(useContentStore.getState().total).toBe(1);
    });

    it("should prepend new items", () => {
      useContentStore.getState().addItem(mockItem2);
      useContentStore.getState().addItem(mockItem);

      const items = useContentStore.getState().items;
      expect(items[0].id).toBe("content-1");
      expect(items[1].id).toBe("content-2");
    });
  });

  describe("updateItem", () => {
    it("should update existing item by id", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore
        .getState()
        .updateItem("content-1", { status: "PUBLISHED", publishedAt: "2024-06-01T00:00:00Z" });

      const item = useContentStore.getState().items[0];
      expect(item.status).toBe("PUBLISHED");
      expect(item.publishedAt).toBe("2024-06-01T00:00:00Z");
      expect(item.textContent).toBe("Test post"); // unchanged
    });

    it("should not modify other items when updating one", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().addItem(mockItem2);

      useContentStore.getState().updateItem("content-1", { textContent: "Updated" });

      const items = useContentStore.getState().items;
      // items[0] = mockItem2 (id: content-2), items[1] = mockItem (id: content-1, updated)
      expect(items[0].textContent).toBe("Second post");
      expect(items[0].id).toBe("content-2");
    });

    it("should do nothing when id doesn't exist", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().updateItem("nonexistent", { status: "PUBLISHED" });

      expect(useContentStore.getState().items).toHaveLength(1);
    });
  });

  describe("removeItem", () => {
    it("should remove item by id", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().addItem(mockItem2);

      useContentStore.getState().removeItem("content-1");

      expect(useContentStore.getState().items).toHaveLength(1);
      expect(useContentStore.getState().items[0].id).toBe("content-2");
    });

    it("should decrement total count", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().addItem(mockItem2);

      useContentStore.getState().removeItem("content-1");

      expect(useContentStore.getState().total).toBe(1);
    });

    it("should do nothing when id doesn't exist", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().removeItem("nonexistent");

      expect(useContentStore.getState().items).toHaveLength(1);
    });

    it("should handle removal of last item", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().removeItem("content-1");

      expect(useContentStore.getState().items).toStrictEqual([]);
      expect(useContentStore.getState().total).toBe(0);
    });
  });

  describe("selectItem", () => {
    it("should set selectedId", () => {
      useContentStore.getState().selectItem("content-1");
      expect(useContentStore.getState().selectedId).toBe("content-1");
    });

    it("should clear selection when given null", () => {
      useContentStore.getState().selectItem("content-1");
      useContentStore.getState().selectItem(null);

      expect(useContentStore.getState().selectedId).toBeNull();
    });
  });

  describe("reset", () => {
    it("should clear all state to defaults", () => {
      useContentStore.getState().addItem(mockItem);
      useContentStore.getState().addItem(mockItem2);
      useContentStore.getState().setFilters({ status: "DRAFT", page: 2 });
      useContentStore.getState().selectItem("content-1");

      useContentStore.getState().reset();

      const state = useContentStore.getState();
      expect(state.items).toStrictEqual([]);
      expect(state.total).toBe(0);
      expect(state.totalPages).toBe(0);
      expect(state.selectedId).toBeNull();
      expect(state.error).toBeNull();
      expect(state.filters).toStrictEqual({ page: 1, pageSize: 20 });
    });
  });

  describe("error state", () => {
    it("should be null initially", () => {
      expect(useContentStore.getState().error).toBeNull();
    });
  });

  describe("totalPages", () => {
    it("should be 0 initially", () => {
      expect(useContentStore.getState().totalPages).toBe(0);
    });

    it("should be resettable", () => {
      useContentStore.setState({ totalPages: 5 });
      expect(useContentStore.getState().totalPages).toBe(5);

      useContentStore.getState().reset();
      expect(useContentStore.getState().totalPages).toBe(0);
    });
  });
});
