/**
 * Admin User Detail Page
 * Shows user profile details, agents, teams, and usage stats
 */

"use client";

import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import { Skeleton } from "@socialcreator/ui/skeleton";
import { AlertCircle, ArrowLeft, Mail, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { Breadcrumb } from "@/components/layout/breadcrumb";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  cguAccepted: boolean;
  createdAt: string;
  profiles: {
    id: string;
    name: string;
    platforms: string[];
    _count: { agents: number; generatedContents: number };
  }[];
  ownedTeams: { id: string; name: string }[];
  teamMemberships: {
    id: string;
    role: string;
    team: { id: string; name: string };
  }[];
  stats: {
    totalContent: number;
    publishedContent: number;
  };
}

function AdminUserDetailContent() {
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch user");
        }
        const data = await res.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [userId]);

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

  if (!user) return null;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Administration", href: "/admin" },
          { label: "Utilisateurs", href: "/admin/users" },
          { label: user.name || user.email },
        ]}
      />

      <div className="flex items-center gap-4 mt-2 mb-6">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center text-title-lg text-muted mb-3">
                {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-title-md font-semibold">{user.name || "Unnamed"}</h2>
              <div className="flex items-center gap-1 mt-1 text-body-sm text-muted">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </div>
              <div className="mt-3">
                <Badge
                  variant="outline"
                  className={user.role === "ADMIN" ? "bg-purple-500/10 text-purple-600" : ""}
                >
                  {user.role === "ADMIN" && <Shield className="w-3 h-3 mr-1" />}
                  {user.role}
                </Badge>
              </div>
              <p className="text-caption text-muted mt-3">
                Membre depuis {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <p className="text-caption text-muted">
                CGU {user.cguAccepted ? "acceptées" : "non acceptées"}
              </p>
            </div>
          </div>
        </div>

        {/* Stats & Teams */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4">Statistiques d'utilisation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-surface-strong">
                <p className="text-caption text-muted">Contenu généré</p>
                <p className="text-display-sm font-semibold text-ink mt-1">
                  {user.stats.totalContent.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-surface-strong">
                <p className="text-caption text-muted">Publications réussies</p>
                <p className="text-display-sm font-semibold text-ink mt-1">
                  {user.stats.publishedContent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Profiles */}
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4">Profils ({user.profiles.length})</h3>
            {user.profiles.length === 0 ? (
              <p className="text-body-sm text-muted">Aucun profil</p>
            ) : (
              <div className="space-y-3">
                {user.profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-strong"
                  >
                    <div>
                      <p className="text-body-sm font-medium">{profile.name}</p>
                      <div className="flex gap-1 mt-1">
                        {profile.platforms.map((p) => (
                          <Badge key={p} variant="outline" className="text-caption">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-caption text-muted">
                      <p>
                        {profile._count.agents} agent{profile._count.agents !== 1 ? "s" : ""}
                      </p>
                      <p>{profile._count.generatedContents} contenus</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teams */}
          <div className="rounded-lg border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4">Équipes</h3>
            {user.ownedTeams.length === 0 && user.teamMemberships.length === 0 ? (
              <p className="text-body-sm text-muted">Aucune équipe</p>
            ) : (
              <div className="space-y-2">
                {user.ownedTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-surface-strong"
                  >
                    <Users className="w-4 h-4 text-yellow-500" />
                    <span className="text-body-sm">{team.name}</span>
                    <Badge
                      variant="outline"
                      className="ml-auto bg-yellow-500/10 text-yellow-600 text-caption"
                    >
                      Propriétaire
                    </Badge>
                  </div>
                ))}
                {user.teamMemberships.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-surface-strong"
                  >
                    <Users className="w-4 h-4 text-muted" />
                    <span className="text-body-sm">{m.team.name}</span>
                    <Badge variant="outline" className="ml-auto text-caption">
                      {m.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUserDetailPage() {
  return (
    <AdminGuard>
      <AdminUserDetailContent />
    </AdminGuard>
  );
}
