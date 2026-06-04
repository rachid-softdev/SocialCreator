/**
 * Tests for ActiveAgents component.
 *
 * Verifies:
 * - Shows empty state when no agents provided
 * - Renders list of agents with names and types
 * - Each agent card is clickable (cursor-pointer)
 * - Shows "Last run" for agents with lastRun
 * - Handles undefined agents gracefully
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ActiveAgents } from "@/components/dashboard/active-agents";

vi.mock("@socialcreator/utils", () => ({
  formatDateTime: vi.fn(() => "Jun 1, 2025"),
}));

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: [
    { value: "X", icon: "𝕏" },
    { value: "LINKEDIN", icon: "in" },
  ],
}));

vi.mock("lucide-react", () => ({
  Bot: "svg-bot",
}));

describe("ActiveAgents", () => {
  it("shows empty state when agents array is empty", () => {
    render(<ActiveAgents agents={[]} />);

    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(
      screen.getByText("No active agents. Create a profile and add an agent to get started."),
    ).toBeInTheDocument();
  });

  it("shows empty state when agents is undefined", () => {
    render(<ActiveAgents />);

    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(
      screen.getByText("No active agents. Create a profile and add an agent to get started."),
    ).toBeInTheDocument();
  });

  it("renders list of agents with names and types", () => {
    const agents = [
      {
        id: "agent-1",
        name: "Content Bot",
        type: "TEXT_POST" as const,
        isActive: true,
        platforms: ["X" as const],
        profileName: "Main Profile",
      },
      {
        id: "agent-2",
        name: "Video Clipper",
        type: "VIDEO_CLIP" as const,
        isActive: true,
        platforms: ["LINKEDIN" as const],
        profileName: "Main Profile",
      },
    ];

    render(<ActiveAgents agents={agents as any} />);

    expect(screen.getByText("Content Bot")).toBeInTheDocument();
    expect(screen.getByText("Video Clipper")).toBeInTheDocument();
    expect(screen.getByText("Text Post")).toBeInTheDocument();
    expect(screen.getByText("Video Clip")).toBeInTheDocument();
  });

  it("renders last run info when agent has lastRun", () => {
    const agents = [
      {
        id: "agent-1",
        name: "Content Bot",
        type: "TEXT_POST" as const,
        isActive: true,
        platforms: ["X" as const],
        profileName: "Main Profile",
        lastRun: { startedAt: new Date("2025-06-01T10:00:00Z") },
      },
    ];

    render(<ActiveAgents agents={agents as any} />);

    expect(screen.getByText(/Last run:/)).toBeInTheDocument();
  });

  it("does not show last run when agent has no lastRun", () => {
    const agents = [
      {
        id: "agent-1",
        name: "Content Bot",
        type: "TEXT_POST" as const,
        isActive: true,
        platforms: ["X" as const],
        profileName: "Main Profile",
      },
    ];

    render(<ActiveAgents agents={agents as any} />);

    expect(screen.queryByText(/Last run:/)).not.toBeInTheDocument();
  });

  it("renders agent cards with cursor-pointer class indicating clickability", () => {
    const agents = [
      {
        id: "agent-1",
        name: "Content Bot",
        type: "TEXT_POST" as const,
        isActive: true,
        platforms: ["X" as const],
        profileName: "Main Profile",
      },
    ];

    render(<ActiveAgents agents={agents as any} />);

    const card = document.querySelector(".cursor-pointer");
    expect(card).toBeInTheDocument();
  });
});
