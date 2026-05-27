/**
 * Content Page - Server Component
 * Fetches data and renders the client component
 */

import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentPageClient } from "./content-page-client";

export default async function ContentPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch all content for the user with proper typing
  const contents = await prisma.generatedContent.findMany({
    where: {
      profile: { userId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    include: {
      profile: {
        select: { id: true, name: true },
      },
      run: {
        select: {
          id: true,
          agent: {
            select: { id: true, name: true },
          },
        },
      },
    },
    take: 50,
  });

  // Proper type casting instead of `as any`
  const typedContents: GeneratedContentWithRelations[] = contents;

  // Stats
  const stats = await prisma.generatedContent.groupBy({
    by: ["status"],
    where: {
      profile: { userId: session.user.id },
    },
    _count: true,
  });

  const statMap = stats.reduce(
    (acc, s) => {
      acc[s.status] = s._count;
      return acc;
    },
    {} as Record<string, number>,
  );

  return <ContentPageClient initialContents={typedContents} stats={statMap} />;
}
