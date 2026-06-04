/**
 * Admin Users Page
 * List, search, edit roles, and delete users
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
import { AlertCircle, Loader2, Shield, Trash2, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchBar } from "@/components/shared/search-bar";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminUsersContent />
    </AdminGuard>
  );
}

function AdminUsersContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  // Edit role dialog
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [editRole, setEditRole] = useState<"USER" | "ADMIN">("USER");
  const [editLoading, setEditLoading] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Refetch when page or search changes
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (search.trim()) {
          params.set("search", search.trim());
        }
        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch users");
        }
        const data = await res.json();
        setUsers(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalItems(data.pagination.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [page, search]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleEditRole = useCallback(async () => {
    if (!editDialog.user) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editDialog.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error?.fieldErrors?.role?.[0] || data.error || "Failed to update role",
        );
      }
      setEditDialog({ open: false, user: null });
      router.refresh();
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === editDialog.user?.id ? { ...u, role: editRole } : u)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setEditLoading(false);
    }
  }, [editDialog.user, editRole, router]);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteDialog.user) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteDialog.user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      setDeleteDialog({ open: false, user: null });
      router.refresh();
      setUsers((prev) => prev.filter((u) => u.id !== deleteDialog.user?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteDialog.user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Administration", href: "/admin" }, { label: "Utilisateurs" }]}
      />
      <PageHeader title="Utilisateurs" description="Gérez les utilisateurs de la plateforme" />

      {error && (
        <div className="mt-4 rounded-lg bg-danger/10 border border-danger/20 p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-danger shrink-0" />
          <p className="text-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Search */}
      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Rechercher par email ou nom..."
        className="mt-6"
      />

      {/* Users table */}
      <div className="mt-4 border border-hairline rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-strong border-b border-hairline">
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Nom</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Email</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">Rôle</th>
              <th className="text-left px-4 py-3 text-caption text-muted font-medium">
                Inscrit le
              </th>
              <th className="text-right px-4 py-3 text-caption text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-body-sm text-muted">
                  Aucun utilisateur trouvé
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-hairline last:border-b-0 hover:bg-surface-strong/50 transition-colors"
                >
                  <td className="px-4 py-3 text-body-sm text-ink font-medium">
                    {user.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-body-sm text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={user.role === "ADMIN" ? "bg-purple-500/10 text-purple-600" : ""}
                    >
                      {user.role === "ADMIN" && <Shield className="w-3 h-3 mr-1" />}
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-body-sm text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        title="Modifier le rôle"
                        onClick={() => {
                          setEditRole(user.role);
                          setEditDialog({ open: true, user });
                        }}
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      {session?.user?.id !== user.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2 text-muted hover:text-red-500"
                          title="Supprimer"
                          onClick={() => setDeleteDialog({ open: true, user })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={limit}
        onPageChange={setPage}
      />

      {/* Edit Role Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) setEditDialog({ open: false, user: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changer le rôle de {editDialog.user?.name || editDialog.user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as "USER" | "ADMIN")}
              className="w-full bg-surface-card border border-hairline rounded-lg px-3 py-2 text-body-sm"
            >
              <option value="USER">USER — Accès standard</option>
              <option value="ADMIN">ADMIN — Accès administrateur</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, user: null })}>
              Annuler
            </Button>
            <Button onClick={handleEditRole} disabled={editLoading}>
              {editLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, user: null });
        }}
        title="Supprimer l'utilisateur ?"
        description={`Êtes-vous sûr de vouloir supprimer ${deleteDialog.user?.name || deleteDialog.user?.email} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
}
