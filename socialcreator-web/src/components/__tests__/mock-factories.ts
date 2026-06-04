/**
 * Shared vi.hoisted mock factory functions for React component tests.
 *
 * IMPORTANT: These MUST be used inside vi.hoisted() callbacks since
 * vi.mock is hoisted to the top of the file by Vitest.
 */

import { vi } from "vitest";

export function createNextNavigationMocks() {
  return {
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    })),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    usePathname: vi.fn(() => "/"),
  };
}

export function createNextAuthMocks() {
  return {
    useSession: vi.fn(() => ({
      data: null,
      status: "loading",
    })),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

/**
 * Create a mock zustand store hook.
 * Returns a vi.fn that accepts a selector and returns the matching slice.
 */
export function createStoreMock(initialState: Record<string, unknown>) {
  return vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
    return selector(initialState);
  });
}

/**
 * Mock for lucide-react icons.
 * Provide a list of icon names used by the component.
 */
export function createLucideIconMocks(icons: string[]) {
  const mocks: Record<string, string> = {};
  for (const icon of icons) {
    mocks[icon] = `svg-${icon.toLowerCase()}`;
  }
  return mocks;
}

/**
 * Mock for recharts chart components.
 * All recharts components are mocked as simple div elements.
 */
export function createRechartsMocks() {
  return {
    ResponsiveContainer: "recharts-responsive-container",
    BarChart: "recharts-bar-chart",
    LineChart: "recharts-line-chart",
    PieChart: "recharts-pie-chart",
    Bar: "recharts-bar",
    Line: "recharts-line",
    Pie: "recharts-pie",
    Cell: "recharts-cell",
    XAxis: "recharts-x-axis",
    YAxis: "recharts-y-axis",
    Tooltip: "recharts-tooltip",
    Legend: "recharts-legend",
    CartesianGrid: "recharts-cartesian-grid",
  };
}
