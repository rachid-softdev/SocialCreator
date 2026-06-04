/**
 * Admin Organizations Page
 * List organizations with subscription info
 */

"use client";

import { Badge } from "@socialcreator/ui/badge";
import { Skeleton } from "@socialcreator/ui/skeleton";
import { AlertCircle, Building2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchBar } from "@/components/shared/search-bar";

interface Organization {
  id: string;
  name: string;
  teamId: string | null;
  createdAt: string;
  subscription: {
    planKey: string;
    status: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  _count: {
    entitlementOverrides: number;
  };
}

export default function AdminOrgsPage() {
  return (
    <AdminGuard>
      <OrgsContent />
    </AdminGuard>
  );
}

function OrgsContent() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 20;

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/orgs?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch organizations");
      }
      const data = await res.json();
      setOrgs(data.data);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Debounce search
  const [searchInput, _setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
        items={[{ label: "Administration", href: "/admin" }, { label: "Organisations" }]}
      />
      <PageHeader title="Organisations" description="Gérez les organisations de la plateforme" />

      {error && (
        <div className="mt-4 rounded-lg bg-danger/10 border border-danger/20 p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-danger shrink-0" />
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Search */}
      <SearchBar
        value={searchInput}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Rechercher par nom..."
        className="mt-6"
      />

      {/* Table */}
      <div className="mt-4 border border-hairline rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-strong border-b border-hairline">
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Nom</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Statut</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Overrides</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Créée le</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-hairline">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-body-sm text-muted">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-soft" />
                  Aucune organisation trouvée
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-hairline last:border-b-0 hover:bg-surface-strong/50 transition-colors"
                >
                  <td className="px-4 py-3 text-body-sm text-ink font-medium">
                    <Link
                      href={`/admin/orgs/${org.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{org.subscription?.planKey || "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {org.subscription ? (
                      <Badge variant="outline" className={statusColor(org.subscription.status)}>
                        {org.subscription.status}
                        {org.subscription.cancelAtPeriodEnd && " (annulation en cours)"}
                      </Badge>
                    ) : (
                      <span className="text-body-sm text-muted">Aucun abonnement</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body-sm text-muted">
                    {org._count.entitlementOverrides}
                  </td>
                  <td className="px-4 py-3 text-body-sm text-muted">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
