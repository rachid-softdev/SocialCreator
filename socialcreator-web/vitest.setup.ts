import { vi } from "vitest";

// Provide jest compatibility (existing tests use jest.spyOn etc.)
(globalThis as any).jest = vi;

// Provide default env vars for tests that spy on process.env
if (!("ENCRYPTION_KEY" in process.env)) {
  process.env.ENCRYPTION_KEY = "test-encryption-key";
}
if (!("DATABASE_URL" in process.env)) {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
}
if (!("NEXTAUTH_SECRET" in process.env)) {
  process.env.NEXTAUTH_SECRET = "test-secret-for-testing";
}
if (!("NEXTAUTH_URL" in process.env)) {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}
