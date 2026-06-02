import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OnboardingProfileForm } from "./form";

export default async function OnboardingProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-display-md font-display text-ink mb-2">Create Your Profile</h1>
          <p className="text-body text-muted">
            Set up your first brand profile to start generating content
          </p>
        </div>

        <div className="bg-surface-card border border-hairline-strong rounded-xl p-6">
          <OnboardingProfileForm />
        </div>
      </div>
    </div>
  );
}
