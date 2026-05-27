import { EmptyState } from "@socialcreator/ui/empty-state";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileCard } from "@/components/profile/profile-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const profiles = await prisma.profile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          agents: true,
          generatedContents: true,
          connectedAccounts: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Manage your brand profiles"
        actions={
          <Link
            href="/profiles/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </Link>
        }
      />

      {profiles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No profiles yet"
          description="Create your first profile to start generating content for your brand."
          action={
            <Link
              href="/profiles/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Profile
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
