"use client";

import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: string;
}

/**
 * AdminGuard — Client component that checks if the current user has ADMIN role.
 * Shows a loading spinner while the session is loading.
 * Redirects to the fallback path if the user is not an admin.
 */
export function AdminGuard({ children, fallback = "/dashboard" }: AdminGuardProps) {
  const { data: session, status } = useSession();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      setShouldRedirect(true);
    } else if (status === "authenticated") {
      const role = (session?.user as { role?: string })?.role;
      if (role !== "ADMIN") {
        setShouldRedirect(true);
      }
    }
  }, [session, status]);

  // Handle redirect outside of render
  if (shouldRedirect) {
    redirect(fallback);
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted" />
          <p className="text-body-sm text-muted">Verifying access...</p>
        </div>
      </div>
    );
  }

  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return null;
  }

  return <>{children}</>;
}
