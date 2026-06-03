/**
 * GET /api/debug/entitlements?orgId=X&feature=Y
 * Debug endpoint - returns full DebugTrace with resolution details
 * Admin only in production
 */

import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getFeatureGateService } from "@/lib/entitlements/service";
import logger from "@/lib/logger";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const feature = url.searchParams.get("feature");

    if (!orgId || !feature) {
      return NextResponse.json({ error: "Missing orgId or feature parameter" }, { status: 400 });
    }

    const service = getFeatureGateService();
    const trace = await service.getDebugTrace(orgId, feature);

    // Also get current usage
    const entitlements = await service.getAllEntitlements(orgId);

    const response = {
      ...trace,
      currentUsage: entitlements.usage[feature] || 0,
      currentLimit: entitlements.limits[feature],
      planFeatures: entitlements.features,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, "[Debug Entitlements] GET error");
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
