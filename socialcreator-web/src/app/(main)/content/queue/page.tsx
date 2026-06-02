/**
 * Publish Queue Page
 * Displays real-time job queue status
 */

import { QueueStatus } from "@/components/job-queue/queue-status";
import { PageHeader } from "@/components/layout/page-header";

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Publish Queue" description="Monitor content publishing in real-time" />
      <QueueStatus />
    </div>
  );
}
