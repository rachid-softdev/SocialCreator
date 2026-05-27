/**
 * Teams Settings Page
 * Lists all teams the user has access to and allows creating new teams
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeamDialog } from "./team-dialog";
import { TeamsList } from "./teams-list";

export default async function TeamsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get teams where user is owner or member
  const teams = await prisma.team.findMany({
    where: {
      OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      profiles: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get user profile count for quota check
  const userProfileCount = await prisma.profile.count({
    where: { userId: session.user.id },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-lg">Teams</h1>
          <p className="text-body-sm text-muted mt-1">Collaborate with your team members</p>
        </div>
        <TeamDialog />
      </div>

      <TeamsList teams={teams} currentUserId={session.user.id} profileCount={userProfileCount} />
    </div>
  );
}
