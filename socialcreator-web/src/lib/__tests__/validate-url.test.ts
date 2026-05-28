import { describe, expect, it } from "vitest";
import { validateMediaUrl } from "../validate-url";

describe("validateMediaUrl", () => {
  describe("valid URLs", () => {
    it("should accept standard HTTPS URLs", () => {
      const result = validateMediaUrl("https://storage.example.com/video.mp4");
      expect(result.valid).toBe(true);
    });

    it("should accept HTTPS URLs with query params", () => {
      const result = validateMediaUrl("https://cdn.example.com/video.mp4?token=abc&exp=123");
      expect(result.valid).toBe(true);
    });

    it("should accept subdomain URLs", () => {
      const result = validateMediaUrl("https://media.example.com/path/to/video.mp4");
      expect(result.valid).toBe(true);
    });
  });

  describe("protocol validation", () => {
    it("should reject HTTP URLs", () => {
      const result = validateMediaUrl("http://example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS");
    });

    it("should reject FTP URLs", () => {
      const result = validateMediaUrl("ftp://example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS");
    });

    it("should reject file protocol URLs", () => {
      const result = validateMediaUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS");
    });
  });

  describe("SSRF prevention - private IPs", () => {
    it("should reject 10.x.x.x addresses", () => {
      const result = validateMediaUrl("https://10.0.0.1/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Private IP");
    });

    it("should reject 172.16-31.x.x addresses", () => {
      expect(validateMediaUrl("https://172.16.0.1/video.mp4").valid).toBe(false);
      expect(validateMediaUrl("https://172.20.0.1/video.mp4").valid).toBe(false);
      expect(validateMediaUrl("https://172.31.0.1/video.mp4").valid).toBe(false);
    });

    it("should reject 192.168.x.x addresses", () => {
      const result = validateMediaUrl("https://192.168.1.1/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Private IP");
    });

    it("should reject 169.254.x.x (metadata) addresses", () => {
      const result = validateMediaUrl("https://169.254.169.254/latest/meta-data/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Private IP");
    });

    it("should reject 127.x.x.x (loopback) addresses", () => {
      const result = validateMediaUrl("https://127.0.0.1/video.mp4");
      expect(result.valid).toBe(false);
      // 127.0.0.1 is caught by the localhost check before the private IP check
      expect(result.error).toContain("Localhost");
    });

    it("should reject 0.0.0.0", () => {
      const result = validateMediaUrl("https://0.0.0.0/video.mp4");
      expect(result.valid).toBe(false);
    });
  });

  describe("SSRF prevention - localhost", () => {
    it("should reject localhost hostname", () => {
      const result = validateMediaUrl("https://localhost:3000/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Localhost");
    });

    it("should reject IPv6 localhost", () => {
      const result1 = validateMediaUrl("https://[::1]:3000/video.mp4");
      expect(result1.valid).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    it("should reject empty strings", () => {
      const result = validateMediaUrl("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("should reject null/undefined", () => {
      const result = validateMediaUrl(null as unknown as string);
      expect(result.valid).toBe(false);
    });

    it("should reject malformed URLs", () => {
      const result = validateMediaUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });
  });

  describe("public IPs allowed", () => {
    it("should allow public IP addresses", () => {
      const result = validateMediaUrl("https://8.8.8.8/video.mp4");
      expect(result.valid).toBe(true);
    });

    it("should allow 172.x outside private range", () => {
      const result = validateMediaUrl("https://172.32.0.1/video.mp4");
      expect(result.valid).toBe(true);
    });
  });
});
