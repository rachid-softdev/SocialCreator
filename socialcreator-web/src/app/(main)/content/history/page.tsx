/**
 * Publish History Page
 * Displays past publications across all platforms
 */

import { PublishHistory } from "@/components/content/publish-history";
import { PageHeader } from "@/components/layout/page-header";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Publish History"
        description="View past publications across all platforms"
      />
      <PublishHistory />
    </div>
  );
}
