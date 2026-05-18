"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ProfileForm } from "@/components/profile/profile-form";
import type { ProfileFormData } from "@socialcreator/types/profile";

export default function NewProfilePage() {
  const router = useRouter();

  const handleSubmit = async (data: ProfileFormData) => {
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create profile");
    }

    const result = await response.json();
    router.push(`/profiles/${result.profile.id}`);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: "New Profile" },
        ]}
      />

      <PageHeader
        title="Create Profile"
        description="Set up a new brand profile to generate content"
      />

      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <ProfileForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}