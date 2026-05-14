/**
 * Trigger.dev configuration
 * Enregistre tous les jobs Trigger pour l'exécution en production
 * 
 * Pour utiliser Trigger.dev:
 * 1. Créer un compte sur trigger.dev
 * 2. Créer un nouveau projet
 * 3. Récupérer les clés API (TRIGGER_API_KEY, TRIGGER_PUBLIC_KEY)
 * 4. Configurer les webhooks dans le dashboard Trigger
 * 
 * Les jobs enregistrés:
 * - agent-scheduler: Cron job pour exécuter les agents programmés
 * - publish-worker: Publication async du contenu Approved
 * - video-pipeline: Pipeline complet (transcription, clips, génération)
 */

import { defineConfig } from "@trigger.dev/sdk";
import { agentSchedulerJob } from "./src/triggers/agent-scheduler.trigger";
import { publishJob } from "./src/triggers/publish-worker.trigger";
import { videoPipelineJob } from "./src/triggers/video-pipeline.trigger";

export default defineConfig({
  id: "socialcreator",
  name: "SocialCreator Jobs",
  // Jobs registrados pour Trigger.dev
  jobs: [agentSchedulerJob, publishJob, videoPipelineJob],
  // Configuration du projet Trigger
  project: process.env.TRIGGER_PROJECT_ID || "socialcreator",
  
  // Configuration des retries par défaut pour tous les jobs
  retry: {
    enabled: true,
    maxAttempts: 3,
  },
  
  // Configuration du log
  logLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
});