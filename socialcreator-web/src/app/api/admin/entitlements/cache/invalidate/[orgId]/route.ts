/**
 * POST /api/admin/entitlements/cache/invalidate/:orgId
 * Manually invalidate entitlements cache for an org
 */

import { NextResponse } from "next/server"
import { getFeatureGateService } from "@/lib/entitlements/service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params

    const service = getFeatureGateService()
    await service.invalidateCache(orgId)

    return NextResponse.json({ success: true, orgId })
  } catch (error) {
    console.error("[Cache Invalidate] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}