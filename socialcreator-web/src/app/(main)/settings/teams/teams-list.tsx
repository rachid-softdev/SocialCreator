"use client";

import type { Profile, Team, TeamMember } from "@prisma/client";
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
import {
  Crown,
  Edit,
  Loader2,
  Plus,
  SendHorizonal,
  Settings,
  Shield,
  Trash2,
  Users,
  UserX,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import logger from "@/lib/logger";

interface TeamWithRelations extends Team {
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  members: (TeamMember & {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  })[];
  profiles: Pick<Profile, "id" | "name">[];
}

interface TeamsListProps {
  teams: TeamWithRelations[];
  currentUserId: string;
  profileCount: number;
}

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

const roleColors: Record<string, string> = {
  OWNER: "bg-yellow-500/10 text-yellow-600",
  ADMIN: "bg-purple-500/10 text-purple-600",
  EDITOR: "bg-blue-500/10 text-blue-600",
  VIEWER: "bg-gray-500/10 text-gray-600",
};

export function TeamsList({ teams, currentUserId }: TeamsListProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const [inviteDialog, setInviteDialog] = useState<{ open: boolean; teamId: string }>({
    open: false,
    teamId: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("VIEWER");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (teams.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Users className="w-12 h-12 mx-auto text-muted mb-4" />
        <h3 className="text-title-sm mb-2">No teams yet</h3>
        <p className="text-body-sm text-muted mb-4">Create a team to collaborate with others</p>
      </div>
    );
  }

  const toggleTeam = (teamId: string) => {
    const newOpen = new Set(openTeams);
    if (newOpen.has(teamId)) {
      newOpen.delete(teamId);
    } else {
      newOpen.add(teamId);
    }
    setOpenTeams(newOpen);
  };

  const isUserOwner = (team: TeamWithRelations) => team.ownerId === currentUserId;
  const isUserAdmin = (team: TeamWithRelations) =>
    team.members.some(
      (m) => m.userId === currentUserId && (m.role === "OWNER" || m.role === "ADMIN"),
    );
  const isUserOwnerOrAdmin = (team: TeamWithRelations) => isUserOwner(team) || isUserAdmin(team);

  const handleInvite = async (teamId: string) => {
    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }

    setInviteLoading(true);
    setInviteError("");

    try {
      const response = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      if (response.ok) {
        success("Invitation sent", {
          description: `An invitation has been sent to ${inviteEmail}`,
        });
        setInviteEmail("");
        setInviteRole("VIEWER");
        setInviteDialog({ open: false, teamId: "" });
        router.refresh();
      } else {
        const data = await response.json();
        setInviteError(data.error || "Failed to send invitation");
      }
    } catch (err) {
      logger.error({ err }, "Failed to send invitation");
      setInviteError("Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        success("Member removed");
        router.refresh();
      } else {
        const data = await response.json();
        showError(data.error || "Failed to remove member");
      }
    } catch (err) {
      logger.error({ err }, "Failed to remove member");
      showError("Failed to remove member");
    }
  };

  const handleChangeRole = async (memberId: string, role: string) => {
    try {
      const response = await fetch(`/api/teams/[teamId]/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (response.ok) {
        success("Role updated");
        router.refresh();
      } else {
        const data = await response.json();
        showError(data.error || "Failed to update role");
      }
    } catch (err) {
      logger.error({ err }, "Failed to update role");
      showError("Failed to update role");
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        success("Team deleted");
        setDeleteConfirm(null);
        router.refresh();
      } else {
        const data = await response.json();
        showError(data.error || "Failed to delete team");
      }
    } catch (err) {
      logger.error({ err }, "Failed to delete team");
      showError("Failed to delete team");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="border border-hairline rounded-lg bg-surface-card overflow-hidden"
          >
            {/* Team Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-title-sm">{team.name}</h3>
                  <p className="text-caption text-muted">
                    {team.profiles.length} profile{team.profiles.length !== 1 ? "s" : ""} •{" "}
                    {team.members.length + 1} member{team.members.length !== 0 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isUserOwner(team) && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                    <Crown className="w-3 h-3 mr-1" />
                    Owner
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => toggleTeam(team.id)}>
                  {openTeams.has(team.id) ? "Hide" : "View"} details
                </Button>
                {(isUserOwner(team) || isUserAdmin(team)) && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      title="Invite member"
                      onClick={() => setInviteDialog({ open: true, teamId: team.id })}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="px-2" title="Settings">
                      <Settings className="w-4 h-4" />
                    </Button>
                    {isUserOwner(team) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-red-500"
                        title="Delete team"
                        onClick={() => setDeleteConfirm(team.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {openTeams.has(team.id) && (
              <div className="border-t border-hairline p-4 bg-surface-strong">
                {/* Owner */}
                <div className="mb-4">
                  <h4 className="text-caption uppercase text-muted mb-2">Owner</h4>
                  <div className="flex items-center gap-2">
                    {team.owner.image ? (
                      <Image
                        src={team.owner.image}
                        alt={team.owner.name || ""}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted" />
                    )}
                    <span className="text-body-sm">{team.owner.name || team.owner.email}</span>
                  </div>
                </div>

                {/* Members */}
                {team.members.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-caption uppercase text-muted mb-2">Members</h4>
                    <div className="space-y-2">
                      {team.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {member.user.image ? (
                              <Image
                                src={member.user.image}
                                alt={member.user.name || ""}
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full"
                                unoptimized
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted" />
                            )}
                            <span className="text-body-sm">
                              {member.user.name || member.user.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={roleColors[member.role]}>
                              {member.role === "ADMIN" && <Shield className="w-3 h-3 mr-1" />}
                              {member.role === "EDITOR" && <Edit className="w-3 h-3 mr-1" />}
                              {roleLabels[member.role]}
                            </Badge>
                            {isUserOwnerOrAdmin(team) && member.role !== "OWNER" && (
                              <>
                                <select
                                  defaultValue={member.role}
                                  onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                  className="text-caption bg-surface-card border border-hairline rounded-md px-2 py-1 h-7"
                                >
                                  <option value="ADMIN">Admin</option>
                                  <option value="EDITOR">Editor</option>
                                  <option value="VIEWER">Viewer</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-1.5 h-7 text-muted hover:text-red-500"
                                  title="Remove member"
                                  onClick={() => handleRemoveMember(team.id, member.id)}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty members state */}
                {team.members.length === 0 && (
                  <div className="mb-4 text-center py-4">
                    <p className="text-body-sm text-muted">
                      No members yet. Invite people to collaborate.
                    </p>
                  </div>
                )}

                {/* Profiles */}
                {team.profiles.length > 0 && (
                  <div>
                    <h4 className="text-caption uppercase text-muted mb-2">Shared Profiles</h4>
                    <div className="flex flex-wrap gap-2">
                      {team.profiles.map((profile) => (
                        <Badge key={profile.id} variant="outline">
                          {profile.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Invite Dialog */}
      <Dialog
        open={inviteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setInviteDialog({ open: false, teamId: "" });
            setInviteError("");
            setInviteEmail("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this team. They will receive an email with a link to
              accept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-body-sm font-medium">
                Email address
              </label>
              <TextInput
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError("");
                }}
                error={!!inviteError}
              />
              {inviteError && <p className="text-caption text-semantic-error">{inviteError}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="invite-role" className="text-body-sm font-medium">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full bg-surface-card border border-hairline rounded-lg px-3 py-2 text-body-sm"
              >
                <option value="ADMIN">Admin — Can manage members and settings</option>
                <option value="EDITOR">Editor — Can create and edit content</option>
                <option value="VIEWER">Viewer — Can view content only</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialog({ open: false, teamId: "" });
                setInviteError("");
                setInviteEmail("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => handleInvite(inviteDialog.teamId)} disabled={inviteLoading}>
              {inviteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <SendHorizonal className="w-4 h-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All team data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteTeam(deleteConfirm)}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
