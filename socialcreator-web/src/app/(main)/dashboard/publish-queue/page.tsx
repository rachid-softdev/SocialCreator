/**
 * Publish Queue Dashboard Page
 * Displays real-time queue monitoring with stats and job table
 */

import { PageHeader } from "@/components/layout/page-header";
import { QueueDashboard } from "@/components/queue-monitor/queue-dashboard";

export default function PublishQueuePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Publish Queue"
        description="Monitor and manage content publishing jobs in real-time"
      />
      <QueueDashboard />
    </div>
  );
}
