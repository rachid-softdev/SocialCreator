/**
 * Content Generation Page — Server Component
 * Auth check, render GenerationPanel
 */

import { redirect } from "next/navigation";
import { GenerationPanel } from "@/components/content/generation-panel";
import { auth } from "@/lib/auth";

export default async function ContentGeneratePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-title-lg text-ink">Content Generation</h1>
        <p className="text-body-sm text-muted mt-1">
          Generate AI-powered social media content for any platform
        </p>
      </div>
      <GenerationPanel />
    </div>
  );
}
