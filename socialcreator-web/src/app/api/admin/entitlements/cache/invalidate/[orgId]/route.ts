/**
 * POST /api/admin/entitlements/cache/invalidate/:orgId
 * Manually invalidate entitlements cache for an org
 */

import { NextResponse } from "next/server";
import { getFeatureGateService } from "@/lib/entitlements/service";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireAdmin();

    const service = getFeatureGateService();
    await service.invalidateCache(orgId);

    return NextResponse.json({ success: true, orgId });
  } catch (error) {
    console.error("[Cache Invalidate] POST error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
