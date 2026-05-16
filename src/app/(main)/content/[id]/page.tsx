import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContentStatusBadge } from "@/components/content/content-status-badge";
import { PlatformBadge } from "@/components/content/platform-badge";
import { ContentEditor } from "@/components/content/content-editor";
import { ApprovalPanel } from "@/components/content/approval-panel";
import { formatDateTime } from "@/lib/utils";
import { Check, X, Send } from "lucide-react";
import { ContentDetailClient } from "@/app/(main)/content/[id]/content-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const content = await prisma.generatedContent.findFirst({
    where: {
      id,
      profile: { userId: session.user.id },
    },
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
  });

  if (!content) {
    notFound();
  }

  return <ContentDetailClient content={content} />;
}
