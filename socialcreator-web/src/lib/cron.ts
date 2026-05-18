import cronParser from "cron-parser";

/**
 * Validate a cron expression
 */
export function isValidCron(expression: string): boolean {
  try {
    cronParser.parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the next execution time for a cron expression
 */
export function getNextExecution(expression: string): Date | null {
  try {
    const interval = cronParser.parseExpression(expression);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Format a date for display
 */
export function formatNextRun(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return "Past";

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `in ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `in ${hours} hour${hours > 1 ? "s" : ""}`;
  }
  if (minutes > 0) {
    return `in ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  return "soon";
}

/**
 * Parse a cron expression to human-readable description
 */
export function describeCron(expression: string): string {
  const parts = expression.split(" ");
  if (parts.length < 5) return "Invalid cron expression";

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const descriptions: string[] = [];

  // Time
  if (minute === "0" && hour === "*") {
    descriptions.push("Every hour");
  } else if (minute === "*" && hour === "*") {
    descriptions.push("Every minute");
  } else if (minute === "0") {
    descriptions.push(`At ${hour}:00`);
  } else if (hour !== "*") {
    descriptions.push(`At ${hour}:${minute.padStart(2, "0")}`);
  } else {
    descriptions.push(`${minute} minutes`);
  }

  // Day
  if (dayOfMonth !== "*" && dayOfWeek === "*") {
    descriptions.push(`on day ${dayOfMonth}`);
  } else if (dayOfWeek !== "*" && dayOfMonth === "*") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayNum = parseInt(dayOfWeek);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      descriptions.push(`on ${days[dayNum]}`);
    }
  }

  return descriptions.join(" ");
}
