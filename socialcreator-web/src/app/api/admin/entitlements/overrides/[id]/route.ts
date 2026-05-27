/**
 * DELETE /api/admin/entitlements/overrides/:id
 * Delete an override
 */

import { NextResponse } from "next/server"
import { getEntitlementRepository } from "@/lib/entitlements/repository"
import { requireAdmin, AuthError } from "@/lib/auth/require-admin"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params

    const repo = getEntitlementRepository()
    await repo.deleteOverride(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Admin Override] DELETE error:", error)
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}