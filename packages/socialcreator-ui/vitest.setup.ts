import { vi } from "vitest";

// Mock next/link to avoid peer dependency issues in jsdom tests
vi.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    // Use createElement to avoid JSX transform issues
    const React = require("react");
    return React.createElement("a", { href, ...props }, children);
  };
  MockLink.displayName = "Link";
  return { default: MockLink };
});
