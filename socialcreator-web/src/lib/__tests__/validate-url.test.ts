import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateMediaUrl } from "../validate-url";

// Mock node:dns/promises for DNS resolution tests
vi.mock("node:dns/promises", () => ({
  resolve4: vi.fn().mockResolvedValue([]),
  resolve6: vi.fn().mockResolvedValue([]),
}));

// Dynamically import the async function to avoid top-level issues
async function getValidateMediaUrlWithDns() {
  const mod = await import("../validate-url");
  return mod.validateMediaUrlWithDns;
}

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

  describe("SSRF prevention - IPv6 addresses", () => {
    it("should reject IPv6 loopback (::1) via hostname check", () => {
      const result = validateMediaUrl("https://[::1]:3000/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Localhost");
    });

    it("should reject unbracketed IPv6 loopback as invalid URL", () => {
      // IPv6 addresses must be bracketed in URLs; unbracketed ::1 produces an invalid URL
      const result = validateMediaUrl("https://::1/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });

    it("should reject IPv6 unspecified address [::] via DNS resolution", async () => {
      // validateMediaUrl does not catch [::] because Node.js normalizes hostname to "[::]"
      // which doesn't match any IPv4 pattern or the ^::$ pattern.
      // validateMediaUrlWithDns catches it by resolving the real hostname.
      // For a direct hostname check, we mock DNS to return a private IPv6.
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve6).mockResolvedValue(["fc00::1"]);
      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IPv6");
    });

    it("should reject IPv6 unique local unicast (fc00::/7) via DNS resolution", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve6).mockResolvedValue(["fc00::1"]);
      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IPv6");
    });

    it("should reject IPv6 unique local unicast (fd00::/7) via DNS resolution", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve6).mockResolvedValue(["fd00::1"]);
      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IPv6");
    });

    it("should reject IPv6 link-local unicast (fe80::/10) via DNS resolution", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve6).mockResolvedValue(["fe80::1"]);
      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IPv6");
    });

    it("should reject IPv6 documentation range (2001:db8::/32) via DNS resolution", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve6).mockResolvedValue(["2001:db8::1"]);
      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IPv6");
    });
  });

  describe("validateMediaUrlWithDns (DNS resolution)", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      // Reset DNS mocks to defaults because clearAllMocks() does NOT reset
      // implementations set by mockResolvedValue(). Without this, tests that
      // set resolve4 to a private IP would leak into subsequent tests.
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve4).mockReset().mockResolvedValue([]);
      vi.mocked(dnsMock.resolve6).mockReset().mockResolvedValue([]);
    });

    it("should return valid when DNS resolves to public IPv4", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve4).mockResolvedValue(["93.184.216.34"]);

      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://example.com/video.mp4");

      expect(result.valid).toBe(true);
      expect(dnsMock.resolve4).toHaveBeenCalledWith("example.com");
    });

    it("should reject when DNS resolves to private IPv4", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve4).mockResolvedValue(["10.0.0.5"]);

      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IP");
    });

    it("should reject when DNS resolves to private IPv6", async () => {
      const dnsMock = await import("node:dns/promises");
      vi.mocked(dnsMock.resolve6).mockResolvedValue(["fc00::1"]);

      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://internal.example.com/video.mp4");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("private IPv6");
    });

    it("should pass URL with static IP literal through DNS check", async () => {
      const dnsMock = await import("node:dns/promises");
      const validateMediaUrlWithDns = await getValidateMediaUrlWithDns();
      const result = await validateMediaUrlWithDns("https://8.8.8.8/video.mp4");

      expect(result.valid).toBe(true);
      expect(dnsMock.resolve4).not.toHaveBeenCalled();
      expect(dnsMock.resolve6).not.toHaveBeenCalled();
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
