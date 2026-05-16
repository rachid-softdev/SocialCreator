/**
 * Trigger.dev client initialization
 * Point central pour l'interaction avec Trigger.dev
 *
 * Ce fichier est utilisé par les triggers pour exécuter des jobs
 * et par les API routes pour enqueue des tâches
 */

// Note: SDK v3 has changed API. This is a placeholder for migration.
// The triggers will need to be updated to use the new API.
const clientPlaceholder = {
  defineJob: (...args: any[]) => args[0],
  triggerHttpPayload: (...args: any[]) => args[0],
};

// Export for compatibility with existing trigger files
export const client = clientPlaceholder as any;

// Helper pour vérifier si Trigger est configuré
export function isTriggerConfigured(): boolean {
  return !!(process.env.TRIGGER_API_KEY && process.env.TRIGGER_API_URL);
}

// Helper pour obtenir l'URL de l'API
export function getTriggerApiUrl(): string {
  return process.env.TRIGGER_API_URL || "https://api.trigger.dev";
}

// Types pour les payloads de jobs
export interface AgentRunPayload {
  agentId: string;
  runId: string;
  userId: string;
  profileId: string;
}

export interface PublishPayload {
  contentId: string;
  userId: string;
  profileId: string;
}

export interface VideoPipelinePayload {
  videoAssetId: string;
  profileId: string;
  platforms: string[];
}