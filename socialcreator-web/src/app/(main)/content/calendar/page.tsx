/**
 * Content Calendar Page
 * Displays scheduled content in a monthly calendar view
 */

import { CalendarView } from "@/components/content/calendar-view";
import { PageHeader } from "@/components/layout/page-header";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="View and manage your scheduled content across all platforms"
      />
      <CalendarView />
    </div>
  );
}
