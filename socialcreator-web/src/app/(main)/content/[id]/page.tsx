import { formatDateTime } from "@socialcreator/utils";
import { Check, Send, X } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ContentDetailClient } from "@/app/(main)/content/[id]/content-detail-client";
import { ApprovalPanel } from "@/components/content/approval-panel";
import { ContentEditor } from "@/components/content/content-editor";
import { ContentStatusBadge } from "@/components/content/content-status-badge";
import { PlatformBadge } from "@/components/content/platform-badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
