/**
 * GET /api/entitlements
 * Get current user's entitlements (cached 60s client-side)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeatureGateService } from "@/lib/entitlements/service";

export async function GET(_request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get orgId from user (in a real app, this would be from Team/Organization)
    // For now, create a mapping or use userId as orgId
    const orgId = userId; // In production, get from User->Organization relationship

    const service = getFeatureGateService();
    const entitlements = await service.getAllEntitlements(orgId);

    // Transform for client (serialize dates)
    const response = {
      plan: entitlements.plan,
      status: entitlements.status,
      features: entitlements.features,
      limits: entitlements.limits,
      usage: entitlements.usage,
      reset_at: Object.fromEntries(
        Object.entries(entitlements.resetAt).map(([k, v]) => [k, v.toISOString()]),
      ),
    };

    // Cache-control: cache 60s client-side, revalidate 300s server
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[Entitlements] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
