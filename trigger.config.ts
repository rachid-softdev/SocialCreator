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
 *
 * Note: Ce fichier utilise une configuration de compatibilité.
 * Pour la vraie intégration Trigger.dev, utilisez:
 * import { defineConfig } from "@trigger.dev/sdk";
 */

// Import jobs
import { agentSchedulerJob } from "./src/triggers/agent-scheduler.trigger";
import { publishJob } from "./src/triggers/publish-worker.trigger";
import { videoPipelineJob } from "./src/triggers/video-pipeline.trigger";

/**
 * Configuration des jobs Trigger.dev
 *
 * Ces jobs sont exposés via l'API Trigger.dev et peuvent être déclenchés:
 * - Via cron (agent-scheduler, vérifie chaque heure les agents dus)
 * - Via API (publish-worker, video-pipeline)
 *
 * Configuration requise:
 * - TRIGGER_API_KEY
 * - TRIGGER_PUBLIC_KEY
 * - TRIGGER_PROJECT_ID (par défaut: socialcreator)
 *
 * En développement local, les jobs sont exécutés de manière synchrone
 * si les variables d'environnement Trigger ne sont pas configurées.
 */
const config = {
  id: "socialcreator",
  name: "SocialCreator Jobs",
  // Jobs enregistrés pour Trigger.dev
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
};

// Export default pour compatibilité avec le build
export default config;