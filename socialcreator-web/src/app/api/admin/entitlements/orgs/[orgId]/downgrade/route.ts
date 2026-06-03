/**
 * Admin API for downgrade preview
 * GET /api/admin/entitlements/orgs/:orgId/downgrade?targetPlan=X
 */

import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getDowngradeService } from "@/lib/entitlements/downgrade";
import logger from "@/lib/logger";

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireAdmin();
    const url = new URL(request.url);
    const targetPlan = url.searchParams.get("targetPlan");

    if (!targetPlan) {
      return NextResponse.json({ error: "Missing targetPlan parameter" }, { status: 400 });
    }

    const service = getDowngradeService();
    const preview = await service.previewDowngrade(orgId, targetPlan);

    const affected = preview.filter((p) => p.affected);

    return NextResponse.json({
      orgId,
      targetPlan,
      affectedCount: affected.length,
      features: affected,
    });
  } catch (error) {
    logger.error({ err: error }, "[Downgrade Preview] GET error");
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
