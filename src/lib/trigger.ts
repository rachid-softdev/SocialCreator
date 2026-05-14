/**
 * Trigger.dev client initialization
 * Point central pour l'interaction avec Trigger.dev
 * 
 * Ce fichier est utilisé par les triggers pour exécuter des jobs
 * et par les API routes pour enqueue des tâches
 */

import { client } from "@trigger.dev/sdk";

// Configuration du client Trigger
// Les variables d'environnement doivent être:
// - TRIGGER_API_KEY: Clé secrète pour l'API
// - TRIGGER_PUBLIC_KEY: Clé publique pour le frontend
// - TRIGGER_API_URL: URL de l'API (par défaut: https://api.trigger.dev)

// Export du client configuré
export { client };

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