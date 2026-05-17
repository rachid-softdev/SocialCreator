/**
 * DELETE /api/admin/entitlements/overrides/:id
 * Delete an override
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getEntitlementRepository } from "@/lib/entitlements/repository"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // const session = await auth()
    // if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params

    const repo = getEntitlementRepository()
    await repo.deleteOverride(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Admin Override] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}