"use client"

import { useState } from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type DateRange = "7d" | "30d" | "90d" | "custom"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange, startDate?: Date, endDate?: Date) => void
}

const RANGES: { value: DateRange; label: string; days: number }[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
]

export function DateRangePicker({ value = "30d", onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedRange = RANGES.find((r) => r.value === value)
  const selectedLabel = selectedRange?.label || "Select range"

  const handleSelect = (range: DateRange) => {
    onChange?.(range)
    setIsOpen(false)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date)
  }

  const getDateRange = (range: DateRange) => {
    const r = RANGES.find((r) => r.value === range)
    if (!r || range === "custom") return null

    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - r.days)

    return { start, end }
  }

  const dateRange = getDateRange(value)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-hairline text-body-sm",
          "hover:border-hairline-strong transition-colors"
        )}
      >
        <Calendar className="w-4 h-4 text-muted" />
        <span>{selectedLabel}</span>
        {dateRange && (
          <span className="text-muted ml-1">
            ({formatDate(dateRange.start)} - {formatDate(dateRange.end)})
          </span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-muted", isOpen && "rotate-180 transition-transform")} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-10 w-48 rounded-lg border border-hairline bg-surface-card shadow-card py-1">
          {RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => handleSelect(range.value)}
              className={cn(
                "w-full px-3 py-2 text-left text-body-sm hover:bg-surface-strong transition-colors",
                value === range.value && "bg-surface-strong font-medium"
              )}
            >
              {range.label}
            </button>
          ))}

          <div className="border-t border-hairline my-1" />

          <button
            onClick={() => handleSelect("custom")}
            className={cn(
              "w-full px-3 py-2 text-left text-body-sm hover:bg-surface-strong transition-colors",
              value === "custom" && "bg-surface-strong font-medium"
            )}
          >
            Custom range
          </button>
        </div>
      )}
    </div>
  )
}