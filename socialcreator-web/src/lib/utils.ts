import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export shared utilities from the types package
export {
  formatDate,
  formatDateTime,
  formatDuration,
  hashContent,
  startOfDayUTC,
} from "@socialcreator/utils";
