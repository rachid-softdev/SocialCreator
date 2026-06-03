/**
 * DELETE /api/admin/entitlements/overrides/:id
 * Delete an override
 */

import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { getEntitlementRepository } from "@/lib/entitlements/repository";
import logger from "@/lib/logger";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const { id } = await params;

    const repo = getEntitlementRepository();
    await repo.deleteOverride(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[Admin Override] DELETE error");
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
