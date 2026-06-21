/**
 * Minimal React render helper for vitest + jsdom tests.
 * Avoids the need for @testing-library/react as a dependency.
 */

import type { ReactElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

export interface RenderResult {
  container: HTMLElement;
  cleanup(): void;
}

export function render(ui: ReactElement): RenderResult {
  const container = document.createElement("div");
  container.setAttribute("data-testroot", "");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    cleanup(): void {
      act(() => {
        root.unmount();
      });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    },
  };
}
