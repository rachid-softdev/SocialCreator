/**
 * Admin Organization Detail Page
 * Shows organization info, subscription, team, and overrides
 */

"use client";

import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import { Skeleton } from "@socialcreator/ui/skeleton";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  Layers,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Breadcrumb } from "@/components/layout/breadcrumb";

interface OrgDetail {
  id: string;
  name: string;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: {
    planKey: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  team: {
    id: string;
    name: string;
    owner: {
      id: string;
      name: string | null;
      email: string;
    };
    _count: {
      members: number;
    };
  } | null;
  _count: {
    entitlementOverrides: number;
  };
}

function AdminOrgDetailContent() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch(`/api/admin/orgs/${orgId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch organization");
        }
        const data = await res.json();
        setOrg(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organization");
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [orgId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-48 rounded-lg" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-danger shrink-0" />
        <p className="text-body-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!org) return null;

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/10 text-green-600";
      case "TRIALING":
        return "bg-blue-500/10 text-blue-600";
      case "PAST_DUE":
        return "bg-yellow-500/10 text-yellow-600";
      case "CANCELED":
        return "bg-red-500/10 text-red-600";
      case "UNPAID":
        return "bg-red-500/10 text-red-600";
      default:
        return "";
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Administration", href: "/admin" },
          { label: "Organisations", href: "/admin/orgs" },
          { label: org.name },
        ]}
      />

      <div className="flex items-center gap-4 mt-2 mb-6">
        <Link href="/admin/orgs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Org Info Card */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center text-title-lg text-muted mb-3">
                <Building2 className="w-8 h-8" />
              </div>
              <h2 className="text-title-md font-semibold">{org.name}</h2>
              <div className="flex items-center gap-1 mt-1 text-body-sm text-muted">
                <Calendar className="w-3.5 h-3.5" />
                Créée le {new Date(org.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {org.subscription ? (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-body-sm text-muted">Plan</span>
                    <Badge variant="outline">{org.subscription.planKey}</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-body-sm text-muted">Statut</span>
                    <Badge variant="outline" className={statusColor(org.subscription.status)}>
                      {org.subscription.status}
                      {org.subscription.cancelAtPeriodEnd && " (annulation en cours)"}
                    </Badge>
                  </div>
                  {org.subscription.currentPeriodEnd && (
                    <div className="flex items-center justify-between py-2 border-b border-hairline">
                      <span className="text-body-sm text-muted">Fin de période</span>
                      <span className="text-body-sm text-ink">
                        {new Date(org.subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-body-sm text-muted text-center py-2">Aucun abonnement</p>
              )}

              <div className="flex items-center justify-between py-2 border-b border-hairline">
                <span className="text-body-sm text-muted">Overrides</span>
                <span className="text-body-sm text-ink">{org._count.entitlementOverrides}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Details */}
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted" />
              Abonnement
            </h3>
            {org.subscription ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-surface-strong">
                  <p className="text-caption text-muted">Plan</p>
                  <p className="text-body-sm font-medium text-ink mt-1">
                    {org.subscription.planKey}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-surface-strong">
                  <p className="text-caption text-muted">Statut</p>
                  <p className="text-body-sm font-medium text-ink mt-1">
                    {org.subscription.status}
                  </p>
                </div>
                {org.subscription.currentPeriodStart && (
                  <div className="p-4 rounded-lg bg-surface-strong">
                    <p className="text-caption text-muted">Début de période</p>
                    <p className="text-body-sm font-medium text-ink mt-1">
                      {new Date(org.subscription.currentPeriodStart).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {org.subscription.currentPeriodEnd && (
                  <div className="p-4 rounded-lg bg-surface-strong">
                    <p className="text-caption text-muted">Fin de période</p>
                    <p className="text-body-sm font-medium text-ink mt-1">
                      {new Date(org.subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {org.subscription.cancelAtPeriodEnd && (
                  <div className="col-span-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-body-sm text-yellow-600">
                      L&apos;abonnement est configuré pour être annulé à la fin de la période en
                      cours.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-body-sm text-muted">
                Cette organisation n&apos;a pas d&apos;abonnement actif.
              </p>
            )}
          </div>

          {/* Team Info */}
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              Équipe
            </h3>
            {org.team ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-strong">
                  <div>
                    <p className="text-body-sm font-medium">{org.team.name}</p>
                    <p className="text-caption text-muted">
                      Propriétaire : {org.team.owner.name || org.team.owner.email}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-caption">
                    {org.team._count.members} membre{org.team._count.members !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-body-sm text-muted">
                Cette organisation n&apos;est liée à aucune équipe.
              </p>
            )}
          </div>

          {/* Overrides */}
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted" />
              Surcharges de fonctionnalités
            </h3>
            <div className="p-4 rounded-lg bg-surface-strong flex items-center justify-between">
              <div>
                <p className="text-body-sm text-muted">Nombre total de surcharges</p>
                <p className="text-display-sm font-semibold text-ink mt-1">
                  {org._count.entitlementOverrides}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrgDetailPage() {
  return (
    <AdminGuard>
      <AdminOrgDetailContent />
    </AdminGuard>
  );
}
