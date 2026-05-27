import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CGUConsentForm } from "@/components/auth/cgu-consent-form";

export default async function CGUPage() {
  const session = await auth();

  // If not authenticated, redirect to login
  if (!session?.user) {
    redirect("/login");
  }

  // If already accepted CGU, redirect to dashboard
  // Note: We need to check this via an API call or include it in the session
  // For now, we'll let the form handle this check on the client side
  // In production, you'd want to include this in the session callback

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-display-md font-display text-ink mb-2">Accept Terms to Continue</h1>
          <p className="text-body text-muted">
            Please review and accept our Terms of Service to use SocialCreator
          </p>
        </div>

        <div className="bg-surface-card border border-hairline-strong rounded-xl p-6">
          <CGUConsentForm />
        </div>
      </div>
    </div>
  );
}
