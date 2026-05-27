"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@socialcreator/utils";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className,
      icon: Icon,
      iconPosition = "left",
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variantStyles = {
      primary: "bg-primary text-on-primary hover:bg-primary-active focus:ring-primary",
      outline:
        "border border-hairline-strong text-ink hover:bg-surface-strong focus:ring-hairline-strong",
      ghost: "text-muted hover:text-ink hover:bg-surface-strong focus:ring-surface-strong",
      destructive:
        "bg-semantic-error text-white hover:bg-semantic-error/90 focus:ring-semantic-error",
    };

    const sizeStyles = {
      sm: "px-3 py-1.5 text-caption",
      md: "px-4 py-2 text-button",
      lg: "px-6 py-3 text-body-sm",
    };

    const cls = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cls} {...props}>
        {Icon && iconPosition === "left" && <Icon className="w-4 h-4" />}
        {children}
        {Icon && iconPosition === "right" && <Icon className="w-4 h-4" />}
      </Comp>
    );
  },
);
Button.displayName = "Button";
