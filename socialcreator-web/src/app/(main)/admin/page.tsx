/**
 * Admin Dashboard Page
 * Overview of platform KPIs and stats
 */

"use client";

import { AlertCircle, Building2, FileText, Loader2, SendHorizonal, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";

interface AdminStats {
  users: { total: number; activeThisMonth: number; newThisWeek: number; newThisMonth: number };
  organizations: { total: number; withSubscription: number };
  content: { totalGenerated: number; publishedToday: number; publishedThisMonth: number };
  publications: { today: number; thisMonth: number };
}

function StatsCard({
  label,
  value,
  icon,
  subtext,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-card p-5 flex items-start justify-between">
      <div>
        <p className="text-caption text-muted mb-1">{label}</p>
        <p className="text-display-sm text-ink font-semibold">{value.toLocaleString()}</p>
        {subtext && <p className="text-caption text-muted mt-1">{subtext}</p>}
      </div>
      <div className="text-muted">{icon}</div>
    </div>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch stats");
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 mt-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-danger" />
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <Breadcrumb items={[{ label: "Administration" }]} />
      <PageHeader title="Administration" description="Plateforme - Vue d'ensemble" />

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Utilisateurs"
          value={stats.users.total}
          icon={<Users className="w-6 h-6" />}
          subtext={`${stats.users.newThisMonth} nouveaux ce mois`}
        />
        <StatsCard
          label="Organisations"
          value={stats.organizations.total}
          icon={<Building2 className="w-6 h-6" />}
          subtext={`${stats.organizations.withSubscription} avec abonnement`}
        />
        <StatsCard
          label="Contenu généré"
          value={stats.content.totalGenerated}
          icon={<FileText className="w-6 h-6" />}
          subtext={`${stats.content.publishedToday} publiés aujourd'hui`}
        />
        <StatsCard
          label="Publications"
          value={stats.publications.thisMonth}
          icon={<SendHorizonal className="w-6 h-6" />}
          subtext={`${stats.publications.today} aujourd'hui`}
        />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <DashboardContent />
    </AdminGuard>
  );
}
