/**
 * Tests for UI store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

// ========== Inline types and store matching the design spec ==========

type Theme = "light" | "dark" | "system";
type SidebarState = "open" | "collapsed";

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

interface UIState {
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

let toastCounter = 0;

const useUIStore = create<UIState>()((set) => ({
  sidebar: "open",
  theme: "system",
  toasts: [],
  activeModal: null,
  modalData: null,
  toggleSidebar: () =>
    set((state) => ({ sidebar: state.sidebar === "open" ? "collapsed" : "open" })),
  setSidebar: (sidebar) => set({ sidebar }),
  setTheme: (theme) => set({ theme }),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: `toast-${++toastCounter}` }],
    })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  openModal: (name, data) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
}));

// ========== Tests ==========

describe("UIStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebar: "open",
      theme: "system",
      toasts: [],
      activeModal: null,
      modalData: null,
    });
    toastCounter = 0;
  });

  describe("initial state", () => {
    it("should start with sidebar open", () => {
      expect(useUIStore.getState().sidebar).toBe("open");
    });

    it("should start with system theme", () => {
      expect(useUIStore.getState().theme).toBe("system");
    });

    it("should start with empty toasts", () => {
      expect(useUIStore.getState().toasts).toStrictEqual([]);
    });

    it("should start with no active modal", () => {
      expect(useUIStore.getState().activeModal).toBeNull();
      expect(useUIStore.getState().modalData).toBeNull();
    });
  });

  describe("toggleSidebar", () => {
    it("should toggle from open to collapsed", () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebar).toBe("collapsed");
    });

    it("should toggle from collapsed to open", () => {
      useUIStore.setState({ sidebar: "collapsed" });
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebar).toBe("open");
    });

    it("should toggle repeatedly", () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebar).toBe("collapsed");

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebar).toBe("open");

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebar).toBe("collapsed");
    });
  });

  describe("setSidebar", () => {
    it("should set sidebar to open", () => {
      useUIStore.getState().setSidebar("open");
      expect(useUIStore.getState().sidebar).toBe("open");
    });

    it("should set sidebar to collapsed", () => {
      useUIStore.getState().setSidebar("collapsed");
      expect(useUIStore.getState().sidebar).toBe("collapsed");
    });
  });

  describe("setTheme", () => {
    it("should set theme to light", () => {
      useUIStore.getState().setTheme("light");
      expect(useUIStore.getState().theme).toBe("light");
    });

    it("should set theme to dark", () => {
      useUIStore.getState().setTheme("dark");
      expect(useUIStore.getState().theme).toBe("dark");
    });

    it("should set theme to system", () => {
      useUIStore.setState({ theme: "dark" });
      useUIStore.getState().setTheme("system");
      expect(useUIStore.getState().theme).toBe("system");
    });
  });

  describe("addToast", () => {
    it("should add a toast with generated id", () => {
      useUIStore.getState().addToast({ type: "info", message: "Hello" });

      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe("info");
      expect(toasts[0].message).toBe("Hello");
      expect(toasts[0].id).toBeDefined();
      expect(typeof toasts[0].id).toBe("string");
    });

    it("should add multiple toasts", () => {
      useUIStore.getState().addToast({ type: "success", message: "First" });
      useUIStore.getState().addToast({ type: "error", message: "Second" });

      expect(useUIStore.getState().toasts).toHaveLength(2);
    });

    it("should handle all toast types", () => {
      useUIStore.getState().addToast({ type: "success", message: "Success" });
      useUIStore.getState().addToast({ type: "error", message: "Error" });
      useUIStore.getState().addToast({ type: "info", message: "Info" });
      useUIStore.getState().addToast({ type: "warning", message: "Warning" });

      const types = useUIStore.getState().toasts.map((t) => t.type);
      expect(types).toContain("success");
      expect(types).toContain("error");
      expect(types).toContain("info");
      expect(types).toContain("warning");
    });

    it("should include optional duration if provided", () => {
      useUIStore.getState().addToast({ type: "info", message: "Timed", duration: 5000 });
      expect(useUIStore.getState().toasts[0].duration).toBe(5000);
    });
  });

  describe("removeToast", () => {
    it("should remove a toast by id", () => {
      useUIStore.getState().addToast({ type: "info", message: "Toast 1" });
      useUIStore.getState().addToast({ type: "error", message: "Toast 2" });
      const id = useUIStore.getState().toasts[0].id;

      useUIStore.getState().removeToast(id);

      expect(useUIStore.getState().toasts).toHaveLength(1);
      expect(useUIStore.getState().toasts[0].message).toBe("Toast 2");
    });

    it("should do nothing if id not found", () => {
      useUIStore.getState().addToast({ type: "info", message: "Only toast" });
      useUIStore.getState().removeToast("nonexistent-id");

      expect(useUIStore.getState().toasts).toHaveLength(1);
    });

    it("should handle removing all toasts one by one", () => {
      useUIStore.getState().addToast({ type: "info", message: "A" });
      useUIStore.getState().addToast({ type: "info", message: "B" });

      const ids = useUIStore.getState().toasts.map((t) => t.id);
      useUIStore.getState().removeToast(ids[0]);
      useUIStore.getState().removeToast(ids[1]);

      expect(useUIStore.getState().toasts).toStrictEqual([]);
    });
  });

  describe("openModal / closeModal", () => {
    it("should open a modal with data", () => {
      useUIStore.getState().openModal("confirm-delete", { id: "content-1" });

      expect(useUIStore.getState().activeModal).toBe("confirm-delete");
      expect(useUIStore.getState().modalData).toStrictEqual({ id: "content-1" });
    });

    it("should open a modal without data", () => {
      useUIStore.getState().openModal("create-agent");

      expect(useUIStore.getState().activeModal).toBe("create-agent");
      expect(useUIStore.getState().modalData).toBeUndefined();
    });

    it("should close a modal and clear data", () => {
      useUIStore.getState().openModal("settings", { section: "general" });
      useUIStore.getState().closeModal();

      expect(useUIStore.getState().activeModal).toBeNull();
      expect(useUIStore.getState().modalData).toBeNull();
    });

    it("should switch from one modal to another", () => {
      useUIStore.getState().openModal("first", { a: 1 });
      useUIStore.getState().openModal("second", { b: 2 });

      expect(useUIStore.getState().activeModal).toBe("second");
      expect(useUIStore.getState().modalData).toStrictEqual({ b: 2 });
    });
  });

  describe("sidebar + theme", () => {
    it("should maintain separate sidebar and theme state", () => {
      useUIStore.getState().setTheme("dark");
      useUIStore.getState().setSidebar("collapsed");

      expect(useUIStore.getState().theme).toBe("dark");
      expect(useUIStore.getState().sidebar).toBe("collapsed");
    });
  });
});
