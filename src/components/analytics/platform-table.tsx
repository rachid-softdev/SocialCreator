"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlatformData {
  platform: string
  impressions: number
  engagements: number
  clicks: number
  followers: number
  published: number
}

interface PlatformTableProps {
  data: PlatformData[]
}

type SortKey = keyof PlatformData

export function PlatformTable({ data }: PlatformTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("impressions")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    const multiplier = sortDir === "asc" ? 1 : -1

    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * multiplier
    }
    // Handle string values, converting to string if needed
    const aStr = String(aVal ?? "")
    const bStr = String(bVal ?? "")
    return aStr.localeCompare(bStr) * multiplier
  })

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return sortDir === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "platform", label: "Platform" },
    { key: "impressions", label: "Impressions" },
    { key: "engagements", label: "Engagements" },
    { key: "clicks", label: "Clicks" },
    { key: "followers", label: "Followers" },
    { key: "published", label: "Published" },
  ]

  return (
    <div className="rounded-xl border border-hairline overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-strong border-b border-hairline">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={cn(
                  "px-4 py-3 text-left text-caption font-medium text-muted cursor-pointer hover:text-ink transition-colors",
                  col.key === "platform" && "cursor-default"
                )}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <SortIcon column={col.key} />
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedData.map((row) => (
            <tr
              key={row.platform}
              className="border-b border-hairline hover:bg-surface-strong transition-colors"
            >
              <td className="px-4 py-3 text-body-sm font-medium">{row.platform}</td>
              <td className="px-4 py-3 text-body-sm">{formatNumber(row.impressions)}</td>
              <td className="px-4 py-3 text-body-sm">{formatNumber(row.engagements)}</td>
              <td className="px-4 py-3 text-body-sm">{formatNumber(row.clicks)}</td>
              <td className="px-4 py-3 text-body-sm">
                {row.followers > 0 ? `+${formatNumber(row.followers)}` : "—"}
              </td>
              <td className="px-4 py-3 text-body-sm">{row.published}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}