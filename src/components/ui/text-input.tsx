"use client";

import { clsx } from "clsx";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          "h-[44px] w-full rounded-md border bg-surface-card px-base py-3 text-body-md text-ink placeholder:text-muted-soft",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          error
            ? "border-semantic-error"
            : "border-hairline-strong focus:border-primary-active",
          className
        )}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";