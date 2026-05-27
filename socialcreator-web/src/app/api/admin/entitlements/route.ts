/**
 * Admin API for Feature Flags & Entitlements
 * Single route handler for multiple admin operations
 *
 * GET /api/admin/entitlements?resource=plans|features|overrides
 * POST /api/admin/entitlements (create override)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEntitlementRepository } from "@/lib/entitlements/repository";
import type { OverrideInput } from "@/lib/entitlements/types";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";

const ALLOWED_SORT_FIELDS = ["key", "name", "sortOrder", "createdAt", "isActive"] as const;
const ALLOWED_SORT_ORDERS = ["asc", "desc"] as const;

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") || "plans";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20));
    const sort = url.searchParams.get("sort") || "sortOrder:asc";
    let [sortField, sortOrder] = sort.split(":");

    if (!ALLOWED_SORT_FIELDS.includes(sortField as (typeof ALLOWED_SORT_FIELDS)[number])) {
      sortField = "sortOrder";
    }
    if (!ALLOWED_SORT_ORDERS.includes(sortOrder as (typeof ALLOWED_SORT_ORDERS)[number])) {
      sortOrder = "asc";
    }

    switch (resource) {
      case "plans": {
        const [plans, total] = await Promise.all([
          prisma.plan.findMany({
            orderBy: { [sortField]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.plan.count(),
        ]);

        return NextResponse.json({
          data: plans,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      case "features": {
        const [features, total] = await Promise.all([
          prisma.feature.findMany({
            orderBy: { key: "asc" },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.feature.count(),
        ]);

        return NextResponse.json({
          data: features,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      case "overrides": {
        const scope = url.searchParams.get("scope");
        const scopeId = url.searchParams.get("scopeId");

        const where: Record<string, string> = {};
        if (scope) where.scope = scope;
        if (scopeId) where.scopeId = scopeId;

        const [overrides, total] = await Promise.all([
          prisma.entitlementOverride.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.entitlementOverride.count({ where }),
        ]);

        return NextResponse.json({
          data: overrides,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      default:
        return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Admin Entitlements] GET error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { scope, scopeId, featureKey, enabled, limitValue, expiresAt, reason } = body;

    if (!scope || !scopeId || !featureKey || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: scope, scopeId, featureKey, reason" },
        { status: 400 },
      );
    }

    const VALID_SCOPES = ["ORG", "USER"] as const;
    if (!VALID_SCOPES.includes(scope as (typeof VALID_SCOPES)[number])) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const input: OverrideInput = {
      scope: scope as "ORG" | "USER",
      scopeId,
      featureKey,
      enabled: enabled ?? true,
      limitValue: limitValue ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reason,
    };

    const repo = getEntitlementRepository();
    await repo.createOverride(input);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Entitlements] POST error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
