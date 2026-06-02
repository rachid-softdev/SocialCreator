/**
 * Connected Accounts Page — Server Component
 * Verifies auth and profile ownership, fetches accounts via repository
 */

import type { ConnectedAccount } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";
import { AccountsPageClient } from "./accounts-page-client";

interface AccountsPageProps {
  params: Promise<{ profileId: string }>;
}

/**
 * Serialized version of ConnectedAccount for server-to-client boundary.
 * Date fields become strings after JSON.parse(JSON.stringify(...)).
 */
type SerializedConnectedAccount = {
  [K in keyof ConnectedAccount]: ConnectedAccount[K] extends Date | null
    ? string | null
    : ConnectedAccount[K];
};

export default async function AccountsPage({ params }: AccountsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId } = await params;

  const { profile: profileRepo, connectedAccount: caRepo } = getRepositories();

  // Verify profile ownership
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== session.user.id) {
    notFound();
  }

  // Fetch connected accounts
  const accounts = await caRepo.findByProfileId(profileId);

  // Serialize dates for client component (Dates become strings across the boundary)
  const serializedAccounts: SerializedConnectedAccount[] = JSON.parse(JSON.stringify(accounts));

  return <AccountsPageClient initialAccounts={serializedAccounts} profileId={profileId} />;
}
