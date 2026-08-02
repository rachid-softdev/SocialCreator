/**
 * Admin Entitlements Page
 * View plans, features, and entitlement overrides
 */

"use client";

import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@socialcreator/ui/dialog";
import { TextInput } from "@socialcreator/ui/text-input";
import { AlertCircle, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: string;
  limitValue: number | null;
}

interface Override {
  id: string;
  scope: "ORG" | "USER";
  scopeId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  expiresAt: string | null;
  reason: string;
  createdAt: string;
}

type Tab = "plans" | "features" | "overrides";

function EntitlementsContent() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overrides");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create override dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newOverride, setNewOverride] = useState({
    scope: "ORG" as "ORG" | "USER",
    scopeId: "",
    featureKey: "",
    enabled: true,
    reason: "",
  });

  // Delete override
  const [deleteOverride, setDeleteOverride] = useState<Override | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchResource = useCallback(async (resource: Tab) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/entitlements?resource=${resource}&limit=100`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to fetch ${resource}`);
      }
      const data = await res.json();

      switch (resource) {
        case "plans":
          setPlans(data.data);
          break;
        case "features":
          setFeatures(data.data);
          break;
        case "overrides":
          setOverrides(data.data);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResource(tab);
  }, [tab, fetchResource]);

  const handleCreateOverride = useCallback(async () => {
    if (!newOverride.scopeId.trim()) {
      setCreateError("scopeId is required");
      return;
    }
    if (!newOverride.featureKey.trim()) {
      setCreateError("featureKey is required");
      return;
    }
    if (!newOverride.reason.trim()) {
      setCreateError("reason is required");
      return;
    }

    setCreateLoading(true);
    setCreateError("");

    try {
      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOverride),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        setNewOverride({ scope: "ORG", scopeId: "", featureKey: "", enabled: true, reason: "" });
        router.refresh();
        fetchResource("overrides");
      } else {
        const data = await res.json();
        setCreateError(data.error || "Failed to create override");
      }
    } catch (err) {
      console.error("Failed to create override", err);
      setCreateError("Failed to create override");
    } finally {
      setCreateLoading(false);
    }
  }, [newOverride, router, fetchResource]);

  const handleDeleteOverride = useCallback(async () => {
    if (!deleteOverride) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/entitlements/overrides/${deleteOverride.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteOverride(null);
        router.refresh();
        fetchResource("overrides");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete override");
      }
    } catch (err) {
      console.error("Failed to delete override", err);
      setError("Failed to delete override");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteOverride, router, fetchResource]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overrides", label: "Overrides" },
    { key: "plans", label: "Plans" },
    { key: "features", label: "Features" },
  ];

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Administration", href: "/admin" }, { label: "Entitlements" }]}
      />
      <PageHeader
        title="Entitlements"
        description="Gérez les plans, fonctionnalités et overrides"
      />

      {error && (
        <div className="mt-4 rounded-lg bg-danger/10 border border-danger/20 p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-danger shrink-0" />
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-hairline">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-body-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        {tab === "overrides" && (
          <div className="ml-auto pb-2">
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nouvel override
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted" />
          </div>
        ) : tab === "plans" ? (
          <PlansTable plans={plans} />
        ) : tab === "features" ? (
          <FeaturesTable features={features} />
        ) : (
          <OverridesTable overrides={overrides} onDelete={setDeleteOverride} />
        )}
      </div>

      {/* Create Override Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel override</DialogTitle>
            <DialogDescription>
              Créer un override d'entitlement pour une organisation ou un utilisateur
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {createError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-caption text-red-600">{createError}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="override-scope" className="text-body-sm font-medium">
                Scope
              </label>
              <select
                id="override-scope"
                value={newOverride.scope}
                onChange={(e) =>
                  setNewOverride({ ...newOverride, scope: e.target.value as "ORG" | "USER" })
                }
                className="w-full bg-surface-card border border-hairline rounded-lg px-3 py-2 text-body-sm"
              >
                <option value="ORG">ORG</option>
                <option value="USER">USER</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="override-scope-id" className="text-body-sm font-medium">
                Scope ID
              </label>
              <TextInput
                id="override-scope-id"
                placeholder="orgId ou userId"
                value={newOverride.scopeId}
                onChange={(e) => setNewOverride({ ...newOverride, scopeId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="override-feature-key" className="text-body-sm font-medium">
                Feature Key
              </label>
              <TextInput
                id="override-feature-key"
                placeholder="ex: advanced_analytics"
                value={newOverride.featureKey}
                onChange={(e) => setNewOverride({ ...newOverride, featureKey: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="override-enabled" className="text-body-sm font-medium">
                Enabled
              </label>
              <select
                id="override-enabled"
                value={newOverride.enabled ? "true" : "false"}
                onChange={(e) =>
                  setNewOverride({ ...newOverride, enabled: e.target.value === "true" })
                }
                className="w-full bg-surface-card border border-hairline rounded-lg px-3 py-2 text-body-sm"
              >
                <option value="true">Activé</option>
                <option value="false">Désactivé</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="override-reason" className="text-body-sm font-medium">
                Raison (obligatoire)
              </label>
              <TextInput
                id="override-reason"
                placeholder="Pourquoi cet override est créé ?"
                value={newOverride.reason}
                onChange={(e) => setNewOverride({ ...newOverride, reason: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateOverride} disabled={createLoading}>
              {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Override Dialog */}
      <ConfirmDialog
        open={!!deleteOverride}
        onOpenChange={(open) => {
          if (!open) setDeleteOverride(null);
        }}
        title="Supprimer l'override ?"
        description={
          deleteOverride
            ? `Supprimer l'override pour ${deleteOverride.featureKey} sur ${deleteOverride.scope}:${deleteOverride.scopeId} ?`
            : ""
        }
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDeleteOverride}
      />
    </div>
  );
}

function PlansTable({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return <p className="text-body-sm text-muted py-8 text-center">Aucun plan trouvé</p>;
  }

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-strong border-b border-hairline">
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Clé</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Nom</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Ordre</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Actif</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id} className="border-b border-hairline last:border-b-0">
              <td className="px-4 py-3 text-body-sm font-mono text-ink">{plan.key}</td>
              <td className="px-4 py-3 text-body-sm text-ink">{plan.name}</td>
              <td className="px-4 py-3 text-body-sm text-muted">{plan.sortOrder}</td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    plan.isActive ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                  }
                >
                  {plan.isActive ? "Oui" : "Non"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeaturesTable({ features }: { features: Feature[] }) {
  if (features.length === 0) {
    return <p className="text-body-sm text-muted py-8 text-center">Aucune feature trouvée</p>;
  }

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-strong border-b border-hairline">
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Clé</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Nom</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Type</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Limite</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.id} className="border-b border-hairline last:border-b-0">
              <td className="px-4 py-3 text-body-sm font-mono text-ink">{feature.key}</td>
              <td className="px-4 py-3 text-body-sm text-ink">{feature.name}</td>
              <td className="px-4 py-3 text-body-sm text-muted">{feature.type}</td>
              <td className="px-4 py-3 text-body-sm text-muted">
                {feature.limitValue !== null ? feature.limitValue : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverridesTable({
  overrides,
  onDelete,
}: {
  overrides: Override[];
  onDelete: (o: Override) => void;
}) {
  if (overrides.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Shield className="w-12 h-12 mx-auto text-muted mb-4" />
        <h3 className="text-title-sm mb-2">Aucun override</h3>
        <p className="text-body-sm text-muted mb-4">
          Créez un override pour activer ou désactiver une feature pour une organisation ou un
          utilisateur spécifique.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-strong border-b border-hairline">
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Scope</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Scope ID</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Feature</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">État</th>
            <th className="text-left px-4 py-3 text-caption text-muted font-medium">Raison</th>
            <th className="text-right px-4 py-3 text-caption text-muted font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {overrides.map((o) => (
            <tr
              key={o.id}
              className="border-b border-hairline last:border-b-0 hover:bg-surface-strong/50"
            >
              <td className="px-4 py-3 text-body-sm text-ink">
                <Badge variant="outline">{o.scope}</Badge>
              </td>
              <td className="px-4 py-3 text-body-sm font-mono text-muted">{o.scopeId}</td>
              <td className="px-4 py-3 text-body-sm font-mono text-ink">{o.featureKey}</td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    o.enabled ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                  }
                >
                  {o.enabled ? "Activé" : "Désactivé"}
                </Badge>
              </td>
              <td
                className="px-4 py-3 text-body-sm text-muted max-w-[200px] truncate"
                title={o.reason}
              >
                {o.reason}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-muted hover:text-red-500"
                  title="Supprimer"
                  onClick={() => onDelete(o)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EntitlementsPage() {
  return (
    <AdminGuard>
      <EntitlementsContent />
    </AdminGuard>
  );
}
