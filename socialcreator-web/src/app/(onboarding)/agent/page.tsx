import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingAgentForm } from "./form";

interface PageProps {
  searchParams: Promise<{ profileId?: string }>;
}

export default async function OnboardingAgentPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { profileId } = await searchParams;

  if (!profileId) {
    redirect("/onboarding/profile");
  }

  // Fetch profile to verify ownership and display name
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { id: true, name: true, platforms: true },
  });

  if (!profile) {
    redirect("/onboarding/profile");
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-display-md font-display text-ink mb-2">Create Your Agent</h1>
          <p className="text-body text-muted">
            Set up your first content agent to start generating posts
          </p>
        </div>

        <div className="bg-surface-card border border-hairline-strong rounded-xl p-6">
          <OnboardingAgentForm
            profileId={profile.id}
            profileName={profile.name}
            platforms={profile.platforms as string[]}
          />
        </div>
      </div>
    </div>
  );
}
