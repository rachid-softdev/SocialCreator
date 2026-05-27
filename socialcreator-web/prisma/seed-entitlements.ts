/**
 * Feature Flags & Entitlements - Database Seed
 * Run with: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Feature Flags & Entitlements...");

  // ============================================
  // Create Plans
  // ============================================

  const plans = [
    { key: "free", name: "Free", priceMonthly: 0, sortOrder: 0 },
    { key: "starter", name: "Starter", priceMonthly: 5000, sortOrder: 1 },
    { key: "pro", name: "Pro", priceMonthly: 7000, sortOrder: 2 },
    { key: "team", name: "Team", priceMonthly: 11000, sortOrder: 3 },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: plan,
      create: plan,
    });
  }

  console.log("✓ Plans created");

  // ============================================
  // Create Features
  // ============================================

  const features = [
    {
      key: "EXPORT_PDF",
      name: "Export to PDF",
      description: "Export content to PDF format",
      type: "BOOLEAN" as const,
      defaultConfig: {},
    },
    {
      key: "AI_SUMMARY",
      name: "AI Content Summary",
      description: "AI-generated summaries for content",
      type: "BOOLEAN" as const,
      defaultConfig: {},
    },
    {
      key: "AI_GENERATIONS",
      name: "AI Generations",
      description: "Monthly AI content generation quota",
      type: "LIMIT" as const,
      defaultConfig: { defaultLimit: 10 },
    },
    {
      key: "VIDEO_CLIPPING",
      name: "Video Clipping",
      description: "Automatic video clipping from long videos",
      type: "BOOLEAN" as const,
      defaultConfig: {},
    },
    {
      key: "TEAM_COLLABORATION",
      name: "Team Collaboration",
      description: "Invite team members and collaborate",
      type: "BOOLEAN" as const,
      defaultConfig: {},
    },
    {
      key: "ADVANCED_ANALYTICS",
      name: "Advanced Analytics",
      description: "Detailed analytics and insights",
      type: "BOOLEAN" as const,
      defaultConfig: {},
    },
    {
      key: "SCHEDULED_PUBLISHING",
      name: "Scheduled Publishing",
      description: "Schedule posts for future publication",
      type: "BOOLEAN" as const,
      defaultConfig: {},
    },
    {
      key: "NEW_DASHBOARD",
      name: "New Dashboard Experiment",
      description: "A/B test for new dashboard design",
      type: "EXPERIMENT" as const,
      defaultConfig: { percentage: 50, seed: "NEW_DASHBOARD_v1" },
    },
  ];

  for (const feature of features) {
    await prisma.feature.upsert({
      where: { key: feature.key },
      update: feature,
      create: feature,
    });
  }

  console.log("✓ Features created");

  // ============================================
  // Create Plan Features (feature-to-plan mapping)
  // ============================================

  const planFeatures = [
    // FREE PLAN
    { planKey: "free", featureKey: "AI_GENERATIONS", enabled: true, limitValue: 3 },
    { planKey: "free", featureKey: "SCHEDULED_PUBLISHING", enabled: true, limitValue: null },

    // STARTER PLAN
    { planKey: "starter", featureKey: "EXPORT_PDF", enabled: false, limitValue: null },
    { planKey: "starter", featureKey: "AI_SUMMARY", enabled: true, limitValue: null },
    { planKey: "starter", featureKey: "AI_GENERATIONS", enabled: true, limitValue: 20 },
    { planKey: "starter", featureKey: "VIDEO_CLIPPING", enabled: false, limitValue: null },
    { planKey: "starter", featureKey: "TEAM_COLLABORATION", enabled: false, limitValue: null },
    { planKey: "starter", featureKey: "ADVANCED_ANALYTICS", enabled: false, limitValue: null },
    { planKey: "starter", featureKey: "SCHEDULED_PUBLISHING", enabled: true, limitValue: null },

    // PRO PLAN
    { planKey: "pro", featureKey: "EXPORT_PDF", enabled: true, limitValue: 50 },
    { planKey: "pro", featureKey: "AI_SUMMARY", enabled: true, limitValue: null },
    { planKey: "pro", featureKey: "AI_GENERATIONS", enabled: true, limitValue: 100 },
    { planKey: "pro", featureKey: "VIDEO_CLIPPING", enabled: true, limitValue: 10 },
    { planKey: "pro", featureKey: "TEAM_COLLABORATION", enabled: true, limitValue: 2 },
    { planKey: "pro", featureKey: "ADVANCED_ANALYTICS", enabled: true, limitValue: null },
    { planKey: "pro", featureKey: "SCHEDULED_PUBLISHING", enabled: true, limitValue: null },

    // TEAM PLAN (Enterprise-like)
    { planKey: "team", featureKey: "EXPORT_PDF", enabled: true, limitValue: null }, // Unlimited
    { planKey: "team", featureKey: "AI_SUMMARY", enabled: true, limitValue: null },
    { planKey: "team", featureKey: "AI_GENERATIONS", enabled: true, limitValue: null }, // Unlimited
    { planKey: "team", featureKey: "VIDEO_CLIPPING", enabled: true, limitValue: null }, // Unlimited
    { planKey: "team", featureKey: "TEAM_COLLABORATION", enabled: true, limitValue: null },
    { planKey: "team", featureKey: "ADVANCED_ANALYTICS", enabled: true, limitValue: null },
    { planKey: "team", featureKey: "SCHEDULED_PUBLISHING", enabled: true, limitValue: null },
  ];

  for (const pf of planFeatures) {
    const plan = await prisma.plan.findUnique({ where: { key: pf.planKey } });
    const feature = await prisma.feature.findUnique({ where: { key: pf.featureKey } });

    if (plan && feature) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: plan.id,
            featureId: feature.id,
          },
        },
        update: {
          enabled: pf.enabled,
          limitValue: pf.limitValue,
        },
        create: {
          planId: plan.id,
          featureId: feature.id,
          enabled: pf.enabled,
          limitValue: pf.limitValue,
          configJson: {},
        },
      });
    }
  }

  console.log("✓ Plan features created");

  // ============================================
  // Create Experiments
  // ============================================

  const experiments = [
    {
      key: "NEW_DASHBOARD",
      name: "New Dashboard",
      description: "A/B test for new dashboard UI",
      config: { percentage: 50, seed: "NEW_DASHBOARD_v1", variantNames: ["control", "variant"] },
    },
  ];

  for (const exp of experiments) {
    await prisma.experiment.upsert({
      where: { key: exp.key },
      update: { config: exp.config as any },
      create: exp,
    });
  }

  console.log("✓ Experiments created");

  console.log("\n✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
