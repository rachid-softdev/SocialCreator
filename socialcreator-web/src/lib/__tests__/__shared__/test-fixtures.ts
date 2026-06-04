/**
 * Standard mock data objects for Zustand store tests.
 * Each fixture matches the corresponding store's exported type.
 */

import type { Agent, AgentRun } from "@/lib/stores/agent-store";
import type { User as AuthUser } from "@/lib/stores/auth-store";
import type { ContentItem } from "@/lib/stores/content-store";
import type { Profile } from "@/lib/stores/profile-store";

export const mockUser: AuthUser = {
  id: "user-1",
  email: "test@test.com",
  name: "Test User",
  image: null,
  role: "USER",
};

export const mockAgent: Agent = {
  id: "agent-1",
  profileId: "profile-1",
  name: "Test Agent",
  type: "content",
  platforms: ["X"],
  isActive: true,
  autoPublish: false,
  scheduleCron: null,
  maxPerDay: 2,
  runCount: 0,
  createdAt: "2024-01-01",
};

export const mockAgentRun: AgentRun = {
  id: "run-1",
  agentId: "agent-1",
  brief: "Test brief",
  status: "SUCCESS",
  startedAt: "2024-01-01",
  finishedAt: "2024-01-01",
  error: null,
  contentCount: 1,
  createdAt: "2024-01-01",
};

export const mockContentItem: ContentItem = {
  id: "content-1",
  profileId: "profile-1",
  platform: "X",
  textContent: "Hello",
  mediaUrls: [],
  hashtags: [],
  status: "DRAFT",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

export const mockProfile: Profile = {
  id: "profile-1",
  name: "Test Profile",
  brandVoice: "",
  platforms: [],
  avatarUrl: null,
  isActive: true,
  teamId: null,
  connectedAccountCount: 0,
  agentCount: 0,
};
