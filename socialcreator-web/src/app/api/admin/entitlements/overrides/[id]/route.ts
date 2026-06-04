/**
 * DELETE /api/admin/entitlements/overrides/:id
 * Delete an override
 */

import { NextResponse } from "next/server";
import { adminAudit } from "@/lib/admin-audit";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getEntitlementRepository } from "@/lib/entitlements/repository";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit-redis";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const rateLimited = await withRateLimit(request, { userId: admin.id });
    if (rateLimited) return rateLimited;

    const { id } = await params;

    const repo = getEntitlementRepository();
    await repo.deleteOverride(id);

    adminAudit.info("entitlement.override.delete", {
      adminId: admin.id,
      overrideId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[Admin Override] DELETE error");
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
