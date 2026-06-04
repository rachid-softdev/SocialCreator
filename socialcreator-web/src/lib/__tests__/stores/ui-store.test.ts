/**
 * Tests for UI store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { mockLocalStorage } from "@/lib/__tests__/__shared__/mock-factory";
import { useUIStore as useRealUIStore } from "@/lib/stores/ui-store";

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

// ========== Import-based tests: persist, toasts, modals ==========

describe("ui-store [integration] — persist, toast, modal", () => {
  beforeEach(() => {
    useRealUIStore.setState({
      sidebar: "open",
      theme: "system",
      toasts: [],
      activeModal: null,
      modalData: null,
    });
    vi.clearAllMocks();
  });

  describe("sidebar", () => {
    it("toggleSidebar toggles between open and collapsed", () => {
      expect(useRealUIStore.getState().sidebar).toBe("open");
      useRealUIStore.getState().toggleSidebar();
      expect(useRealUIStore.getState().sidebar).toBe("collapsed");
      useRealUIStore.getState().toggleSidebar();
      expect(useRealUIStore.getState().sidebar).toBe("open");
    });

    it("setSidebar sets sidebar state directly", () => {
      useRealUIStore.getState().setSidebar("collapsed");
      expect(useRealUIStore.getState().sidebar).toBe("collapsed");
      useRealUIStore.getState().setSidebar("open");
      expect(useRealUIStore.getState().sidebar).toBe("open");
    });
  });

  describe("theme", () => {
    it("setTheme updates theme", () => {
      useRealUIStore.getState().setTheme("dark");
      expect(useRealUIStore.getState().theme).toBe("dark");
      useRealUIStore.getState().setTheme("light");
      expect(useRealUIStore.getState().theme).toBe("light");
      useRealUIStore.getState().setTheme("system");
      expect(useRealUIStore.getState().theme).toBe("system");
    });
  });

  describe("toasts", () => {
    it("addToast generates an ID and adds the toast", () => {
      useRealUIStore.getState().addToast({
        type: "info",
        message: "Test toast",
      });

      const toasts = useRealUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe("info");
      expect(toasts[0].message).toBe("Test toast");
      expect(typeof toasts[0].id).toBe("string");
      expect(toasts[0].id.length).toBeGreaterThan(0);
    });

    it("addToast can accept optional duration", () => {
      useRealUIStore.getState().addToast({
        type: "success",
        message: "Timed",
        duration: 3000,
      });

      expect(useRealUIStore.getState().toasts[0].duration).toBe(3000);
    });

    it("removeToast dismisses a toast by id", () => {
      useRealUIStore.getState().addToast({ type: "info", message: "A" });
      useRealUIStore.getState().addToast({ type: "error", message: "B" });
      const id = useRealUIStore.getState().toasts[0].id;

      useRealUIStore.getState().removeToast(id);

      expect(useRealUIStore.getState().toasts).toHaveLength(1);
      expect(useRealUIStore.getState().toasts[0].message).toBe("B");
    });

    it("removeToast does nothing for nonexistent id", () => {
      useRealUIStore.getState().addToast({ type: "info", message: "Only" });
      useRealUIStore.getState().removeToast("nonexistent");

      expect(useRealUIStore.getState().toasts).toHaveLength(1);
    });
  });

  describe("modal", () => {
    it("openModal sets active modal with data", () => {
      useRealUIStore.getState().openModal("confirm", { id: "x" });

      expect(useRealUIStore.getState().activeModal).toBe("confirm");
      expect(useRealUIStore.getState().modalData).toStrictEqual({ id: "x" });
    });

    it("openModal sets active modal without data", () => {
      useRealUIStore.getState().openModal("simple");

      expect(useRealUIStore.getState().activeModal).toBe("simple");
      expect(useRealUIStore.getState().modalData).toBeUndefined();
    });

    it("closeModal clears active modal and data", () => {
      useRealUIStore.getState().openModal("settings", { section: "general" });
      useRealUIStore.getState().closeModal();

      expect(useRealUIStore.getState().activeModal).toBeNull();
      expect(useRealUIStore.getState().modalData).toBeNull();
    });
  });

  describe("persist middleware", () => {
    it("persists theme and sidebar but not toasts or modal", async () => {
      // Fresh store instance so localStorage is mocked before createJSONStorage evaluates
      const { store: lsStore } = mockLocalStorage();
      vi.resetModules();
      const { useUIStore: persistStore } = await import("@/lib/stores/ui-store");

      persistStore.getState().setTheme("dark");
      persistStore.getState().setSidebar("collapsed");
      persistStore.getState().addToast({ type: "info", message: "Temp" });
      persistStore.getState().openModal("test", { x: 1 });

      const storedRaw = lsStore.get("sc-ui-storage");
      expect(storedRaw).not.toBeNull();

      const parsed = JSON.parse(storedRaw as string);
      // persisted
      expect(parsed.state).toHaveProperty("theme", "dark");
      expect(parsed.state).toHaveProperty("sidebar", "collapsed");
      // NOT persisted
      expect(parsed.state).not.toHaveProperty("toasts");
      expect(parsed.state).not.toHaveProperty("activeModal");
      expect(parsed.state).not.toHaveProperty("modalData");
    });
  });
});
