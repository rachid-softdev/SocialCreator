"use client";

import type { Profile, Team, TeamMember } from "@prisma/client";
import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import { Crown, Edit, Settings, Shield, Trash2, Users } from "lucide-react";
import { useState } from "react";

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

const roleLabels = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

const roleColors = {
  OWNER: "bg-yellow-500/10 text-yellow-600",
  ADMIN: "bg-purple-500/10 text-purple-600",
  EDITOR: "bg-blue-500/10 text-blue-600",
  VIEWER: "bg-gray-500/10 text-gray-600",
};

export function TeamsList({ teams, currentUserId }: TeamsListProps) {
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());

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

  return (
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
                  <Button variant="ghost" size="sm" className="px-2" title="Settings">
                    <Settings className="w-4 h-4" />
                  </Button>
                  {isUserOwner(team) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 text-red-500"
                      title="Delete team"
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
                    <img
                      src={team.owner.image}
                      alt={team.owner.name || ""}
                      className="w-6 h-6 rounded-full"
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
                            <img
                              src={member.user.image}
                              alt={member.user.name || ""}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted" />
                          )}
                          <span className="text-body-sm">
                            {member.user.name || member.user.email}
                          </span>
                        </div>
                        <Badge variant="outline" className={roleColors[member.role]}>
                          {member.role === "ADMIN" && <Shield className="w-3 h-3 mr-1" />}
                          {member.role === "EDITOR" && <Edit className="w-3 h-3 mr-1" />}
                          {roleLabels[member.role]}
                        </Badge>
                      </div>
                    ))}
                  </div>
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
  );
}
