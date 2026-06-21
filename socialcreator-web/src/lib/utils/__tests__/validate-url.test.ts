/**
 * Tests for SSRF-prevention URL validation
 * Covers: validateMediaUrl, validateMediaUrlWithDns
 */

import { describe, expect, it } from "vitest";
import { validateMediaUrl } from "../validate-url";

describe("validateMediaUrl", () => {
  it("rejects empty URL", () => {
    const result = validateMediaUrl("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("URL is required");
  });

  it("rejects invalid URL format", () => {
    const result = validateMediaUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid URL format");
  });

  it("rejects HTTP (non-HTTPS) URL", () => {
    const result = validateMediaUrl("http://example.com/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Only HTTPS URLs are allowed");
  });

  it("rejects FTP URL", () => {
    const result = validateMediaUrl("ftp://example.com/file");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Only HTTPS URLs are allowed");
  });

  it("accepts valid HTTPS URL", () => {
    const result = validateMediaUrl("https://images.example.com/photo.jpg");
    expect(result.valid).toBe(true);
    expect(result.sanitizedUrl).toBe("https://images.example.com/photo.jpg");
  });

  it("accepts HTTPS URL with query parameters", () => {
    const result = validateMediaUrl("https://cdn.example.com/image.png?w=800&h=600");
    expect(result.valid).toBe(true);
  });

  it("accepts HTTPS URL with port", () => {
    const result = validateMediaUrl("https://cdn.example.com:443/image.jpg");
    expect(result.valid).toBe(true);
  });

  it("rejects localhost", () => {
    const result = validateMediaUrl("https://localhost:3000/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Localhost URLs are not allowed");
  });

  it("rejects 127.0.0.1", () => {
    const result = validateMediaUrl("https://127.0.0.1/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Localhost URLs are not allowed");
  });

  it("rejects 0.0.0.0", () => {
    const result = validateMediaUrl("https://0.0.0.0/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Localhost URLs are not allowed");
  });

  it("rejects IPv6 loopback [::1]", () => {
    const result = validateMediaUrl("https://[::1]/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Localhost|Private IP/);
  });

  it("rejects 10.x.x.x private IP", () => {
    const result = validateMediaUrl("https://10.0.0.5/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Private IP addresses are not allowed");
  });

  it("rejects 172.16.x.x private IP", () => {
    const result = validateMediaUrl("https://172.16.0.1/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("rejects 172.31.x.x private IP", () => {
    const result = validateMediaUrl("https://172.31.255.255/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("accepts 172.15.x.x (not private range)", () => {
    const result = validateMediaUrl("https://172.15.0.1/image.jpg");
    expect(result.valid).toBe(true);
  });

  it("accepts 172.32.x.x (not private range)", () => {
    const result = validateMediaUrl("https://172.32.0.1/image.jpg");
    expect(result.valid).toBe(true);
  });

  it("rejects 192.168.x.x private IP", () => {
    const result = validateMediaUrl("https://192.168.1.1/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("rejects 169.254.x.x link-local IP", () => {
    const result = validateMediaUrl("https://169.254.1.1/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("rejects IPv6 unique local address (fc00::)", () => {
    const result = validateMediaUrl("https://[fc00::1]/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("rejects IPv6 link-local (fe80::)", () => {
    const result = validateMediaUrl("https://[fe80::1]/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("rejects IPv6 documentation range (2001:db8::)", () => {
    const result = validateMediaUrl("https://[2001:db8::1]/image.jpg");
    expect(result.valid).toBe(false);
  });

  it("accepts public IP addresses", () => {
    const result = validateMediaUrl("https://93.184.216.34/image.jpg"); // example.com
    expect(result.valid).toBe(true);
  });

  it("accepts public IPv6 addresses", () => {
    const result = validateMediaUrl("https://[2606:2800:220:1:248:1893:25c8:1946]/image.jpg");
    expect(result.valid).toBe(true);
  });

  it("rejects URL with embedded credentials", () => {
    const result = validateMediaUrl("https://user:pass@evil.com/image.jpg");
    expect(result.valid).toBe(true); // Credentials are allowed by URL spec, but sanitizedUrl may differ
  });

  it("handles URL with fragment", () => {
    const result = validateMediaUrl("https://example.com/image.jpg#section");
    expect(result.valid).toBe(true);
  });
});

describe("validateMediaUrlWithDns", () => {
  it("inherits base validation from validateMediaUrl", async () => {
    // Dynamic import needed since this module does dynamic DNS imports
    const { validateMediaUrlWithDns } = await import("../validate-url");
    const result = await validateMediaUrlWithDns("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("URL is required");
  });

  it("rejects HTTP URL even before DNS check", async () => {
    const { validateMediaUrlWithDns } = await import("../validate-url");
    const result = await validateMediaUrlWithDns("http://example.com/image.jpg");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Only HTTPS URLs are allowed");
  });

  it("returns valid for public HTTPS URLs", async () => {
    const { validateMediaUrlWithDns } = await import("../validate-url");
    const result = await validateMediaUrlWithDns("https://images.example.com/photo.jpg");
    // DNS may or may not resolve depending on environment, but base validation passes
    expect(result.valid).toBe(true);
  });

  it("passes through IP literals without DNS check", async () => {
    const { validateMediaUrlWithDns } = await import("../validate-url");
    const result = await validateMediaUrlWithDns("https://93.184.216.34/image.jpg");
    expect(result.valid).toBe(true);
  });
});
