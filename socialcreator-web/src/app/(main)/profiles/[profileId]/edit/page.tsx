import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditProfileForm } from "./edit-profile-form";

interface EditProfilePageProps {
  params: Promise<{ profileId: string }>;
}

export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId } = await params;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: session.user.id },
  });

  if (!profile) {
    notFound();
  }

  return (
    <EditProfileForm
      profile={{
        id: profile.id,
        name: profile.name,
        brandVoice: profile.brandVoice,
        contentBank: profile.contentBank || "",
        platforms: profile.platforms,
      }}
    />
  );
}
