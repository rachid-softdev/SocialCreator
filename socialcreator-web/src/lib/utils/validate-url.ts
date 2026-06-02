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
  // IPv6 private address patterns (SSRF prevention)
  /^::$/i, // IPv6 unspecified address
  /^::1$/i, // IPv6 loopback
  /^fc00:/i, // fc00::/7 unique local unicast
  /^fd00:/i, // fd00::/7 unique local unicast
  /^fe80:/i, // fe80::/10 link-local unicast
  /^2001:db8:/i, // 2001:db8::/32 documentation range
];

function isPrivateIP(hostname: string): boolean {
  // Strip IPv6 brackets (Node.js URL.hostname returns "[::1]" for IPv6)
  const stripped = hostname.replace(/^\[|\]$/g, "");
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(stripped));
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

export async function validateMediaUrlWithDns(url: string): Promise<UrlValidationResult> {
  const baseResult = validateMediaUrl(url);
  if (!baseResult.valid) return baseResult;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  const hostname = parsed.hostname;

  // Skip DNS if hostname is an IP literal (already checked by IP patterns)
  const isIPLiteral =
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(":");
  if (isIPLiteral) return baseResult;

  // Dynamic import to avoid crash in Edge Runtime
  let dns: typeof import("node:dns/promises");
  try {
    dns = await import("node:dns/promises");
  } catch {
    return baseResult; // DNS unavailable, skip check
  }

  // Check IPv4 records
  try {
    const addresses = await dns.resolve4(hostname);
    for (const ip of addresses) {
      if (isPrivateIP(ip)) {
        return { valid: false, error: `URL resolves to private IP address: ${ip}` };
      }
    }
  } catch {
    // DNS resolution failure — skip
  }

  // Check IPv6 records
  try {
    const v6Addresses = await dns.resolve6(hostname);
    for (const ip of v6Addresses) {
      if (isPrivateIP(ip)) {
        return { valid: false, error: `URL resolves to private IPv6 address: ${ip}` };
      }
    }
  } catch {
    // No AAAA records
  }

  return baseResult;
}
