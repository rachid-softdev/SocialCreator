"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ButtonProps {
  variant?: "primary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  href?: string;
  title?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  icon: Icon,
  iconPosition = "left",
  disabled,
  onClick,
  type = "button",
  href,
  title,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

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

  const combinedStyles = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if (href) {
    return (
      <a href={href} className={combinedStyles}>
        {Icon && iconPosition === "left" && <Icon className="w-4 h-4" />}
        {children}
        {Icon && iconPosition === "right" && <Icon className="w-4 h-4" />}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(combinedStyles, disabled && "opacity-50 cursor-not-allowed")}
    >
      {Icon && iconPosition === "left" && <Icon className="w-4 h-4" />}
      {children}
      {Icon && iconPosition === "right" && <Icon className="w-4 h-4" />}
    </button>
  );
}
