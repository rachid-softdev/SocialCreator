"use client";

import { Globe } from "lucide-react";

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
}

/**
 * ~40 common IANA timezones (no deprecated zones), grouped by region.
 * Uses an allowlist so the dropdown stays manageable.
 */
const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Halifax",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Lisbon",
  "Europe/Dublin",
  "Europe/Zurich",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Jerusalem",
  "Asia/Riyadh",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Casablanca",
  "Australia/Sydney",
  "Australia/Perth",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

/**
 * Build region groups from the common list, filtering out unavailable
 * timezones via Intl.supportedValuesOf when it exists.
 */
function buildTimezoneGroups(): Record<string, string[]> {
  let available: Set<string>;
  try {
    available = new Set(Intl.supportedValuesOf("timeZone"));
  } catch {
    // Fallback: assume all are available
    available = new Set(COMMON_TIMEZONES);
  }

  const valid = COMMON_TIMEZONES.filter((tz) => available.has(tz));
  const groups: Record<string, string[]> = {};

  for (const tz of valid) {
    const slashIdx = tz.indexOf("/");
    const region = slashIdx === -1 ? "Other" : tz.slice(0, slashIdx);
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  }

  return groups;
}

const TIMEZONE_GROUPS = buildTimezoneGroups();

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  return (
    <div className="relative">
      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none z-10" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-8 py-2 rounded-lg border border-hairline bg-surface-card text-body-sm text-ink appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      >
        {Object.entries(TIMEZONE_GROUPS).map(([region, timezones]) => (
          <optgroup key={region} label={region}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
