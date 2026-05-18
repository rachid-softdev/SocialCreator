"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ProfileForm } from "@/components/profile/profile-form";
import type { ProfileFormData } from "@socialcreator/types/profile";

interface EditProfileFormProps {
  profile: {
    id: string;
    name: string;
    brandVoice: string;
    contentBank: string;
    platforms: string[];
  };
}

export function EditProfileForm({ profile }: EditProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);

    const response = await fetch(`/api/profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      setIsLoading(false);
      throw new Error(error.error || "Failed to update profile");
    }

    setIsLoading(false);
    router.push(`/profiles/${profile.id}`);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this profile? This action cannot be undone and will remove all associated agents and content.")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete profile");
      }

      router.push("/profiles");
    } catch (error) {
      console.error("Error deleting profile:", error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: profile.name, href: `/profiles/${profile.id}` },
          { label: "Edit" },
        ]}
      />

      <PageHeader
        title="Edit Profile"
        description="Update your profile settings"
      />

      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <ProfileForm 
          initialData={{
            id: profile.id,
            name: profile.name,
            brandVoice: profile.brandVoice,
            contentBank: profile.contentBank,
            platforms: profile.platforms as any,
          }}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>

      {/* Delete Section */}
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <h2 className="text-title-sm text-semantic-error mb-2">Danger Zone</h2>
        <p className="text-body-sm text-muted mb-4">
          Deleting this profile will remove all associated agents, content, and connected accounts. This action cannot be undone.
        </p>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-2 px-4 py-2 rounded-pill border border-semantic-error text-semantic-error text-body-strong hover:bg-semantic-error/10 transition-colors disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete Profile
        </button>
      </div>
    </div>
  );
}