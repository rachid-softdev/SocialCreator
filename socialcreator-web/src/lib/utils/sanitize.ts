/**
 * Sanitization utilities
 * Clean user input to prevent XSS and injection attacks
 */

// Maximum allowed lengths
const MAX_STRING_LENGTH = 10000;
const MAX_ARRAY_LENGTH = 100;
const MAX_DEPTH = 10;

/**
 * Sanitize a string input
 * - Trim whitespace
 * - Remove null bytes
 * - Limit length
 * - Escape HTML entities
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .replace(/\0/g, "") // Remove null bytes
    .slice(0, MAX_STRING_LENGTH)
    .trim();
}

/**
 * Sanitize an object recursively
 * Handles nested objects and arrays
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T, depth = 0): T {
  if (depth > MAX_DEPTH) {
    throw new Error("Maximum object depth exceeded");
  }

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key
    const sanitizedKey = key.replace(/[<>"'&]/g, "").slice(0, 255);
    sanitized[sanitizedKey] = sanitizeValue(value, depth);
  }

  return sanitized as T;
}

/**
 * Sanitize a value based on its type
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }

  return value;
}

/**
 * Sanitize for SQL (basic - not a replacement for parameterized queries)
 * This is a defense-in-depth measure
 */
export function sanitizeForSql(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove common SQL injection patterns
  return input
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, "")
    .replace(/(--|#|\/\*|\*\/)/g, "")
    .slice(0, MAX_STRING_LENGTH);
}

/**
 * Sanitize HTML (for display in React)
 * Note: React escapes by default, this is for when you need explicit HTML
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof dirty !== "string") {
    return "";
  }

  // Basic HTML entity encoding
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return dirty.replace(/[&<>"'/]/g, (char) => entities[char] || char).slice(0, MAX_STRING_LENGTH);
}

/**
 * Sanitize a filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== "string") {
    return "file";
  }

  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

/**
 * Sanitize URL (basic validation)
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") {
    return "";
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    return url.slice(0, 2048);
  } catch {
    return "";
  }
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(input: string[]): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .slice(0, MAX_ARRAY_LENGTH)
    .map((item) => sanitizeString(item))
    .filter((item) => item.length > 0);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") {
    return "";
  }

  const sanitized = email.toLowerCase().trim().slice(0, 254);

  // Basic email regex
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
    return "";
  }

  return sanitized;
}

/**
 * Validate and sanitize UUID
 */
export function isValidUuid(id: string): boolean {
  if (typeof id !== "string") {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Sanitize cron expression (basic validation)
 */
export function sanitizeCronExpression(cron: string): string {
  if (typeof cron !== "string") {
    return "";
  }

  // Basic cron format validation (minute hour day month dayOfWeek)
  const cronRegex =
    /^(\*|[0-5]?\d) (\*|[0-5]?\d) (\*|[12]\d|3[01]|[1-9]) (\*|1[0-2]|[1-9]) (\*|[0-6])$/;

  if (!cronRegex.test(cron)) {
    return "";
  }

  return cron.trim();
}
