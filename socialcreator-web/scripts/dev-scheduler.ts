/**
 * Development Scheduler Script
 * 
 * This script simulates scheduled tasks in development mode.
 * It runs alongside the Next.js dev server to test scheduling functionality.
 * 
 * Usage:
 *   npm run dev:scheduler    - Run scheduler only
 *   npm run dev:all         - Run Next.js + scheduler together
 * 
 * Features:
 * - Scheduled content publishing
 * - Token refresh checks
 * - Platform-specific task handling
 */

import { prisma } from "../src/lib/prisma";
import cron from "cron-parser";
import type { Platform, ContentStatus } from "@prisma/client";

interface ScheduledTask {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
}

const tasks: ScheduledTask[] = [
  {
    name: "Publish scheduled content",
    cronExpression: "* * * * *", // Every minute
    handler: publishScheduledContent,
  },
  {
    name: "Check token expiration",
    cronExpression: "*/5 * * * *", // Every 5 minutes
    handler: checkTokenExpiration,
  },
  {
    name: "Process pending media",
    cronExpression: "*/10 * * * *", // Every 10 minutes
    handler: processPendingMedia,
  },
];

async function publishScheduledContent() {
  console.log("[Scheduler] Checking for scheduled content to publish...");
  
  try {
    const now = new Date();
    
    // Find content that is scheduled to be published
    const contentToPublish = await prisma.generatedContent.findMany({
      where: {
        scheduledPublishAt: {
          lte: now,
        },
        status: "SCHEDULED" as ContentStatus,
      },
      include: {
        profile: {
          include: {
            connectedAccounts: true,
          },
        },
      },
    });

    if (contentToPublish.length === 0) {
      console.log("[Scheduler] No content to publish.");
      return;
    }

    console.log(`[Scheduler] Found ${contentToPublish.length} content item(s) to publish.`);

    for (const content of contentToPublish) {
      try {
        console.log(`[Scheduler] Publishing content: ${content.id}`);
        
        // Find active connected account for this platform
        const connectedAccount = content.profile.connectedAccounts.find(
          ca => ca.platform === content.platform && ca.isActive
        );

        if (!connectedAccount) {
          console.log(`[Scheduler] No active connected account for platform ${content.platform}`);
          // Mark as failed
          await prisma.generatedContent.update({
            where: { id: content.id },
            data: { status: "FAILED" as ContentStatus },
          });
          continue;
        }

        // In production, this would call the appropriate publisher
        // For dev, we just simulate successful publishing
        console.log(`[Scheduler] Would publish to ${content.platform}: ${content.textContent.substring(0, 50)}...`);

        // Simulate publishing delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update status to PUBLISHED
        await prisma.generatedContent.update({
          where: { id: content.id },
          data: { 
            status: "PUBLISHED" as ContentStatus,
            publishedAt: new Date(),
          },
        });

        console.log(`[Scheduler] Successfully published content: ${content.id}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to publish content ${content.id}:`, error);
        
        // Mark as failed
        await prisma.generatedContent.update({
          where: { id: content.id },
          data: { status: "FAILED" as ContentStatus },
        });
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in publishScheduledContent:", error);
  }
}

async function checkTokenExpiration() {
  console.log("[Scheduler] Checking for tokens needing refresh...");
  
  try {
    // Find profiles with tokens expiring within 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    const connectedAccountsWithExpiringTokens = await prisma.connectedAccount.findMany({
      where: {
        expiresAt: {
          lte: fiveMinutesFromNow,
        },
        refreshToken: {
          not: null,
        },
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        profileId: true,
      },
    });

    if (connectedAccountsWithExpiringTokens.length === 0) {
      console.log("[Scheduler] No tokens need refresh.");
      return;
    }

    console.log(`[Scheduler] Found ${connectedAccountsWithExpiringTokens.length} account(s) with expiring tokens.`);
    
    // In production, this would trigger the OAuth middleware refresh
    // For dev, just log the accounts
    for (const account of connectedAccountsWithExpiringTokens) {
      console.log(`[Scheduler] Token expiring soon for account ${account.id} (profile: ${account.profileId}, platform: ${account.platform})`);
    }
  } catch (error) {
    console.error("[Scheduler] Error in checkTokenExpiration:", error);
  }
}

async function processPendingMedia() {
  console.log("[Scheduler] Checking for pending media processing...");
  
  try {
    // Find media assets that are still uploading
    const pendingMedia = await prisma.videoAsset.findMany({
      where: {
        status: {
          in: ["UPLOADING", "PROCESSING"],
        },
      },
      take: 10,
    });

    if (pendingMedia.length === 0) {
      console.log("[Scheduler] No pending media to process.");
      return;
    }

    console.log(`[Scheduler] Found ${pendingMedia.length} media asset(s) pending.`);
    
    for (const media of pendingMedia) {
      console.log(`[Scheduler] Would process media: ${media.id} for profile ${media.profileId}`);
      // In production, this would check Mux status and update accordingly
    }
  } catch (error) {
    console.error("[Scheduler] Error in processPendingMedia:", error);
  }
}

async function runTask(task: ScheduledTask) {
  try {
    const startTime = Date.now();
    await task.handler();
    const duration = Date.now() - startTime;
    console.log(`[Scheduler] Task "${task.name}" completed in ${duration}ms`);
  } catch (error) {
    console.error(`[Scheduler] Task "${task.name}" failed:`, error);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("SocialCreator Development Scheduler");
  console.log("=".repeat(60));
  console.log(`Running ${tasks.length} scheduled tasks...`);
  console.log("");
  
  // Validate cron expressions
  for (const task of tasks) {
    try {
      cron.parseExpression(task.cronExpression);
      console.log(`✓ Task "${task.name}" - cron: ${task.cronExpression}`);
    } catch (error) {
      console.error(`✗ Invalid cron for "${task.name}": ${task.cronExpression}`);
      process.exit(1);
    }
  }
  
  console.log("");
  console.log("Scheduler started. Press Ctrl+C to stop.");
  console.log("");
  
  // Run each task according to its schedule
  // For development, we'll run all tasks every minute to make testing easier
  const interval = setInterval(async () => {
    console.log(`\n[${new Date().toISOString()}] Running scheduled tasks...`);
    
    // Run all tasks in sequence
    for (const task of tasks) {
      await runTask(task);
    }
    
    console.log(`[${new Date().toISOString()}] All tasks completed`);
  }, 60000); // Run every minute in dev mode
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\nShutting down scheduler...");
    clearInterval(interval);
    process.exit(0);
  });
  
  process.on("SIGTERM", () => {
    console.log("\n\nShutting down scheduler...");
    clearInterval(interval);
    process.exit(0);
  });
  
  // Run once on startup
  console.log("Initial run...");
  for (const task of tasks) {
    await runTask(task);
  }
}

main().catch((error) => {
  console.error("Scheduler crashed:", error);
  process.exit(1);
});