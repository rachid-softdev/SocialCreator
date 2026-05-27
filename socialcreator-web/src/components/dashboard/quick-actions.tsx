"use client";

import { Bot, FileText, Plus } from "lucide-react";
import Link from "next/link";

export function QuickActions() {
  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-6">
      <h3 className="text-title-sm text-ink mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/profiles/new"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-hairline-strong text-body-strong text-ink hover:bg-surface-strong hover:shadow-card transition-all"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </Link>
        <Link
          href="/agents/new"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-hairline-strong text-body-strong text-ink hover:bg-surface-strong hover:shadow-card transition-all"
        >
          <Bot className="w-4 h-4" />
          New Agent
        </Link>
        <Link
          href="/content"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-hairline-strong text-body-strong text-ink hover:bg-surface-strong hover:shadow-card transition-all"
        >
          <FileText className="w-4 h-4" />
          View Content
        </Link>
      </div>
    </div>
  );
}
