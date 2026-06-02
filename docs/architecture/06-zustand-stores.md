# State Management with Zustand — SocialCreator

## 1. Overview

There is no Zustand usage in the codebase today. UI components either:
- Fetch data directly in server components (Next.js App Router pattern)
- Pass props through multiple component layers (prop drilling)
- Use local `useState` for client state

This document designs Zustand stores for common UI state patterns, eliminating prop
drilling and providing a predictable client-side state layer.

**Zustand is NOT currently in `package.json`.** It will need to be added:
```
pnpm add zustand
```

## 2. Stores Required

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `useAuthStore` | User session, login/logout, user profile | localStorage |
| `useContentStore` | Content list, CRUD operations, filters | None |
| `useAgentStore` | Agents list, run states, execution tracking | None |
| `useUIStore` | Sidebar, theme, modals, toasts | Theme only |
| `useProfileStore` | Profiles list, selection, switching | Selected profile |

## 3. File Structure

```
socialcreator-web/src/lib/stores/
├── index.ts              # Barrel export
├── auth-store.ts         # useAuthStore
├── content-store.ts      # useContentStore
├── agent-store.ts        # useAgentStore
├── ui-store.ts           # useUIStore
└── profile-store.ts      # useProfileStore
```

## 4. Store Designs

### 4.1 Auth Store

```typescript
// auth-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
      clearUser: () => set({ user: null, isAuthenticated: false, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "sc-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AuthState>),
        isAuthenticated: !!(persisted as AuthState).user,
        isLoading: false,
      }),
    },
  ),
);

export async function syncAuthSession(): Promise<void> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (session?.user?.id) {
    useAuthStore.getState().setUser({
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || null,
      image: session.user.image || null,
      role: (session.user as any)?.role || "USER",
    });
  }
}
```

### 4.2 Content Store

```typescript
// content-store.ts
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
  items: [], total: 0, totalPages: 0, filters: DEFAULT_FILTERS,
  selectedId: null, isLoading: false, error: null,
  setFilters: (partial) => {
    const newFilters = { ...get().filters, ...partial, page: partial.page ?? 1 };
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
      set({ items: data.contents ?? data, total: data.total ?? 0, totalPages: data.totalPages ?? 0, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch content", isLoading: false });
    }
  },
  addItem: (item) => set((state) => ({ items: [item, ...state.items], total: state.total + 1 })),
  updateItem: (id, updates) => set((state) => ({ items: state.items.map((item) => item.id === id ? { ...item, ...updates } : item) })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id), total: state.total - 1 })),
  selectItem: (id) => set({ selectedId: id }),
  reset: () => set({ items: [], total: 0, totalPages: 0, filters: DEFAULT_FILTERS, selectedId: null, error: null }),
}));
```

### 4.3 Agent Store

```typescript
// agent-store.ts
import { create } from "zustand";

export interface AgentRun {
  id: string;
  agentId: string;
  brief: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  contentCount: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  profileId: string;
  name: string;
  type: string;
  platforms: string[];
  isActive: boolean;
  autoPublish: boolean;
  scheduleCron: string | null;
  maxPerDay: number;
  runCount: number;
  latestRun?: { status: string; createdAt: string };
  createdAt: string;
}

export interface AgentState {
  agents: Agent[];
  runs: Record<string, AgentRun[]>;
  selectedAgentId: string | null;
  selectedRunId: string | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  fetchAgents: (profileId: string) => Promise<void>;
  fetchRuns: (agentId: string) => Promise<void>;
  runAgent: (agentId: string) => Promise<string>;
  selectAgent: (id: string | null) => void;
  selectRun: (id: string | null) => void;
  updateRunStatus: (agentId: string, runId: string, status: AgentRun["status"]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  agents: [], runs: {}, selectedAgentId: null, selectedRunId: null,
  isLoading: false, isRunning: false, error: null,
  fetchAgents: async (profileId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/v1/agents?profileId=${profileId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ agents: data.agents ?? data, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch agents", isLoading: false });
    }
  },
  fetchRuns: async (agentId) => {
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/runs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set((state) => ({ runs: { ...state.runs, [agentId]: data.runs ?? data } }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch runs" });
    }
  },
  runAgent: async (agentId) => {
    set({ isRunning: true });
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/run`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      get().fetchRuns(agentId);
      set({ isRunning: false });
      return data.runId;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to run agent", isRunning: false });
      throw err;
    }
  },
  selectAgent: (id) => set({ selectedAgentId: id, selectedRunId: null }),
  selectRun: (id) => set({ selectedRunId: id }),
  updateRunStatus: (agentId, runId, status) => set((state) => {
    const agentRuns = state.runs[agentId];
    if (!agentRuns) return state;
    return { runs: { ...state.runs, [agentId]: agentRuns.map((r) => r.id === runId ? { ...r, status } : r) } };
  }),
  updateAgent: (id, updates) => set((state) => ({ agents: state.agents.map((a) => a.id === id ? { ...a, ...updates } : a) })),
  removeAgent: (id) => set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),
  reset: () => set({ agents: [], runs: {}, selectedAgentId: null, selectedRunId: null, error: null }),
}));
```

### 4.4 UI Store

```typescript
// ui-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
      sidebar: "open", theme: "system", toasts: [], activeModal: null, modalData: null,
      toggleSidebar: () => set((state) => ({ sidebar: state.sidebar === "open" ? "collapsed" : "open" })),
      setSidebar: (sidebar) => set({ sidebar }),
      setTheme: (theme) => set({ theme }),
      addToast: (toast) => set((state) => ({ toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }] })),
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      openModal: (name, data) => set({ activeModal: name, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    { name: "sc-ui-storage", storage: createJSONStorage(() => localStorage), partialize: (state) => ({ theme: state.theme, sidebar: state.sidebar }) },
  ),
);
```

### 4.5 Profile Store

```typescript
// profile-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
      profiles: [], selectedProfileId: null, isLoading: false, error: null,
      selectedProfile: () => get().profiles.find((p) => p.id === get().selectedProfileId) ?? null,
      fetchProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/v1/profiles");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          set({ profiles: data.profiles ?? data, isLoading: false });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "Failed to fetch profiles", isLoading: false });
        }
      },
      selectProfile: (id) => set({ selectedProfileId: id }),
      createProfile: async (data) => {
        set({ isLoading: true });
        try {
          const res = await fetch("/api/v1/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const profile = await res.json();
          set((state) => ({ profiles: [profile, ...state.profiles], selectedProfileId: profile.id, isLoading: false }));
          return profile;
        } catch (err) { set({ error: err instanceof Error ? err.message : "Failed to create profile" }); throw err; }
      },
      updateProfile: async (id, data) => {
        try {
          const res = await fetch(`/api/v1/profiles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const updated = await res.json();
          set((state) => ({ profiles: state.profiles.map((p) => p.id === id ? { ...p, ...updated } : p) }));
        } catch (err) { set({ error: err instanceof Error ? err.message : "Failed to update profile" }); }
      },
      deleteProfile: async (id) => {
        try {
          const res = await fetch(`/api/v1/profiles/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          set((state) => ({ profiles: state.profiles.filter((p) => p.id !== id), selectedProfileId: state.selectedProfileId === id ? null : state.selectedProfileId }));
        } catch (err) { set({ error: err instanceof Error ? err.message : "Failed to delete profile" }); }
      },
      reset: () => set({ profiles: [], selectedProfileId: null, error: null }),
    }),
    { name: "sc-profile-storage", storage: createJSONStorage(() => localStorage), partialize: (state) => ({ selectedProfileId: state.selectedProfileId }) },
  ),
);
```

## 5. Barrel Export

```typescript
// index.ts
export { useAuthStore, syncAuthSession } from "./auth-store";
export type { User, AuthState } from "./auth-store";
export { useContentStore } from "./content-store";
export type { ContentItem, ContentFilters, ContentState } from "./content-store";
export { useAgentStore } from "./agent-store";
export type { Agent, AgentRun, AgentState } from "./agent-store";
export { useUIStore } from "./ui-store";
export type { Theme, SidebarState, Toast, UIState } from "./ui-store";
export { useProfileStore } from "./profile-store";
export type { Profile, ProfileState } from "./profile-store";
```

## 6. Integration

### 6.1 Provider Component (optional but recommended)
```typescript
// src/components/providers/store-provider.tsx
"use client";
import { useEffect } from "react";
import { syncAuthSession } from "@/lib/stores/auth-store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { syncAuthSession(); }, []);
  return <>{children}</>;
}
```

### 6.2 Usage in Components
```typescript
// Before (prop drilling): props passed through multiple layers
// After (Zustand):
function ContentList() {
  const items = useContentStore((s) => s.items);
  const isLoading = useContentStore((s) => s.isLoading);
  const setFilters = useContentStore((s) => s.setFilters);
  // No props needed
}
```

## 7. Testing Strategy

- **Unit tests**: Test each store's actions and state transitions
- **Integration tests**: Test fetch actions with mocked fetch
- **Persistence tests**: Verify localStorage persistence/restoration

```typescript
describe("AuthStore", () => {
  beforeEach(() => { useAuthStore.setState({ user: null, isLoading: false, isAuthenticated: false }); });
  it("sets user and marks as authenticated", () => {
    useAuthStore.getState().setUser({ id: "1", email: "t@t.com", name: "T", image: null, role: "USER" });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
```

## 8. Migration Strategy

| Phase | What | Impact |
|-------|------|--------|
| 1 | Add `zustand` to package.json + `pnpm install` | None |
| 2 | Create all store files | None (new code) |
| 3 | Migrate the sidebar/theme to `useUIStore` | Low |
| 4 | Migrate auth sync to `useAuthStore` | Low |
| 5 | Migrate profile selector to `useProfileStore` | Medium |
| 6 | Migrate content list to `useContentStore` | Medium |
| 7 | Migrate agent page to `useAgentStore` | Medium |
| 8 | Remove old prop-drilling patterns | Low |
