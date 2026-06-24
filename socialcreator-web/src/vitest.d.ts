/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Type declarations for vitest + @testing-library/jest-dom matchers.
 *
 * These provide TypeScript types for DOM matchers (toBeInTheDocument,
 * toBeDisabled, toHaveAttribute, etc.) used by vitest test files.
 *
 * The runtime implementation is loaded via vitest.dom-setup.ts:
 *   import "@testing-library/jest-dom/vitest"
 *
 * Note: @testing-library/jest-dom is not currently installable in this
 * monorepo due to dependency conflicts, so we define the matcher types
 * inline rather than importing from the package.
 */

/* ── Matcher types (subset of @testing-library/jest-dom/matchers) ── */

type ToggleableMatcher<R, T> = (
  this: T,
  received?: any,
  expected?: any
) => R;

interface JestDOMMatchers<R, T = unknown> {
  toBeInTheDocument(): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toBeEmptyDOMElement(): R;
  toBeInvalid(): R;
  toBeRequired(): R;
  toBeValid(): R;
  toBeVisible(): R;
  toContainElement(element: Element | null): R;
  toContainHTML(htmlText: string): R;
  toHaveAccessibleDescription(text?: string | RegExp): R;
  toHaveAccessibleName(text?: string | RegExp): R;
  toHaveAttribute(attr: string, value?: unknown): R;
  toHaveClass(...classNames: string[]): R;
  toHaveStyle(css: string | Record<string, unknown>): R;
  toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
  toHaveFocus(): R;
  toHaveFormValues(expectedValues: Record<string, unknown>): R;
  toHaveTextContent(
    text: string | RegExp,
    options?: { normalizeWhitespace: boolean }
  ): R;
  toHaveValue(value?: string | string[] | number): R;
  toBeChecked(): R;
  toBePartiallyChecked(): R;
  toHaveErrorMessage(text?: string | RegExp): R;
}

/* ── Augment vitest's Assertion interface ── */

import "vitest";

declare module "vitest" {
  interface Assertion<T = any> extends JestDOMMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends JestDOMMatchers<unknown, void> {}
}
