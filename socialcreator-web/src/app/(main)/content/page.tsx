/**
 * Content Page - Server Component
 * Fetches paginated, filtered data from Prisma using URL search params
 */

import type { ContentStatus, Platform } from "@prisma/client";
import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentPageClient } from "./content-page-client";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    platform?: string;
  }>;
}

export default async function ContentPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { page, q, status, platform } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  // Build Prisma where clause from search params
  const where: Record<string, unknown> = {
    profile: { userId: session.user.id },
  };

  if (status) {
    where.status = status as ContentStatus;
  }

  if (platform) {
    where.platform = platform as Platform;
  }

  // Text search on content and hashtags
  if (q) {
    where.OR = [{ textContent: { contains: q, mode: "insensitive" } }, { hashtags: { has: q } }];
  }

  // Fetch one page of content with total count
  const [contents, total, stats] = await Promise.all([
    prisma.generatedContent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
    prisma.generatedContent.count({ where }),
    prisma.generatedContent.groupBy({
      by: ["status"],
      where: {
        profile: { userId: session.user.id },
      },
      _count: true,
    }),
  ]);

  const statMap = stats.reduce(
    (acc, s) => {
      acc[s.status] = s._count;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <ContentPageClient
      initialContents={contents as GeneratedContentWithRelations[]}
      stats={statMap}
      initialPage={currentPage}
      initialQuery={q || ""}
      initialStatus={status || null}
      initialPlatform={platform || null}
      totalPages={totalPages}
      totalItems={total}
    />
  );
}
