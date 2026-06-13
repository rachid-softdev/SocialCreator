/**
 * Publish History Page
 * Displays past publications across all platforms
 */

import { PublishHistory } from "@/components/content/publish-history";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Content", href: "/content" }, { label: "History" }]} />
      <PageHeader
        title="Publish History"
        description="View past publications across all platforms"
      />
      <PublishHistory />
    </div>
  );
}
