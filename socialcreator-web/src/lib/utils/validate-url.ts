/**
 * SSRF prevention — URL validation for server-side requests.
 * Validates protocol, blocks private IPs, localhost, and loopback addresses.
 */

export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.0.0/16
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 169.254.0.0/16
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.0.0.0/8
  /^0\.0\.0\.0$/, // 0.0.0.0
];

function isPrivateIP(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function validateMediaUrl(url: string): UrlValidationResult {
  if (!url) {
    return { valid: false, error: "URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // 1. Protocol must be HTTPS
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTPS URLs are allowed" };
  }

  // 2. Block localhost (including IPv6 ::1)
  if (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "0.0.0.0" ||
    parsed.hostname === "[::1]" ||
    parsed.hostname === "::1"
  ) {
    return { valid: false, error: "Localhost URLs are not allowed" };
  }

  // 3. Block private IP ranges (SSRF critical)
  if (isPrivateIP(parsed.hostname)) {
    return { valid: false, error: "Private IP addresses are not allowed" };
  }

  return { valid: true, sanitizedUrl: parsed.href };
}
