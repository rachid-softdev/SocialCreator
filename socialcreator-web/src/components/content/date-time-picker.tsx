"use client";

import { Calendar, Clock } from "lucide-react";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
}

/**
 * Combines native <input type="date"> and <input type="time">
 * into a single Date value. Prevents selecting dates before minDate.
 */
export function DateTimePicker({ value, onChange, minDate }: DateTimePickerProps) {
  const dateStr = value ? toDateInputValue(value) : "";
  const timeStr = value ? toTimeInputValue(value) : "";

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) {
      onChange(null);
      return;
    }
    // If time is already set, preserve it; otherwise default to 00:00
    onChange(combineDateTime(newDate, timeStr || "00:00"));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    if (!newTime || !dateStr) {
      // If no date selected yet or time cleared, fire null only if both empty
      if (!newTime && !dateStr) onChange(null);
      return;
    }
    onChange(combineDateTime(dateStr, newTime));
  };

  const today = minDate ? toDateInputValue(minDate) : toDateInputValue(new Date());

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="date"
          value={dateStr}
          onChange={handleDateChange}
          min={today}
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-hairline bg-surface-card text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-soft"
        />
      </div>
      <div className="relative flex-1">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="time"
          value={timeStr}
          onChange={handleTimeChange}
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-hairline bg-surface-card text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-soft"
        />
      </div>
    </div>
  );
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combineDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year!, month! - 1, day!, hours!, minutes!);
}
