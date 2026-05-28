/**
 * Validation schemas with Zod
 * Re-exports all schemas from @socialcreator/types
 *
 * This is a barrel file — all schemas are defined in the types package.
 * Existing imports ({ ... } from "@/lib/validations") continue to work.
 */

export type { AgentType, ContentStatus, Platform } from "@socialcreator/types";
export {
  AGENT_TYPES,
  agentIdSchema,
  analyticsFilterSchema,
  analyticsIngestSchema,
  apiKeyIdSchema,
  approveContentSchema,
  CONTENT_STATUS,
  connectAccountSchema,
  contentFilterSchema,
  contentIdSchema,
  createAgentSchema,
  createApiKeySchema,
  createProfileSchema,
  generateClipsSchema,
  mcpCreateAgentSchema,
  mcpGetAgentSchema,
  mcpGetRunStatusSchema,
  mcpListAgentsSchema,
  mcpRunAgentSchema,
  PLATFORMS,
  profileIdSchema,
  publishContentSchema,
  refreshAccountSchema,
  rejectContentSchema,
  runAgentSchema,
  transcribeVideoSchema,
  updateAgentSchema,
  updateProfileSchema,
  videoIdSchema,
  videoUploadSchema,
} from "@socialcreator/types";
