/**
 * Custom test utilities for React component tests.
 * Provides a render wrapper with common providers (next-intl, etc.).
 */
import { type RenderOptions, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

const DEFAULT_MESSAGES: Record<string, string> = {};

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  locale?: string;
  messages?: Record<string, string>;
}

function AllProviders({
  children,
  locale = "en",
  messages = DEFAULT_MESSAGES,
}: {
  children: ReactNode;
  locale?: string;
  messages?: Record<string, string>;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: CustomRenderOptions) {
  const { locale, messages, ...renderOptions } = options ?? {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders locale={locale} messages={messages}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from testing-library for convenience
export {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
