/**
 * Client Layout Wrapper
 * Adds ToastProvider to the main layout
 */

"use client";

import { ReactNode } from "react";
import { ToastProvider } from "@/components/toast-provider";

interface ToastLayoutWrapperProps {
  children: ReactNode;
}

export function ToastLayoutWrapper({ children }: ToastLayoutWrapperProps) {
  return (
    <>
      <ToastProvider />
      {children}
    </>
  );
}