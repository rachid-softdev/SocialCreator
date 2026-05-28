"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { OAuthButton } from "./oauth-button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const checkCGUAndRedirect = async () => {
    try {
      const response = await fetch("/api/auth/cgu-status");
      const data = await response.json();

      if (data.cguAccepted === false) {
        router.push("/onboarding/cgu");
      } else {
        router.push(callbackUrl);
      }
    } catch (_err) {
      // Default to dashboard on error
      router.push(callbackUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        await checkCGUAndRedirect();
      }
    } catch (_err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", {
        callbackUrl: "/api/auth/cgu-redirect",
      });
    } catch (_err) {
      setError("Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-semantic-error/10 border border-semantic-error text-semantic-error text-body-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-body-sm text-body mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 rounded-md border border-hairline-strong bg-surface-card px-4 text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-2 focus:border-ink transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-body-sm text-body mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full h-11 rounded-md border border-hairline-strong bg-surface-card px-4 text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-2 focus:border-ink transition-colors"
            placeholder="Enter your password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-10 rounded-pill bg-primary text-on-primary font-medium text-button flex items-center justify-center hover:bg-primary-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-hairline" />
        </div>
        <div className="relative flex justify-center text-caption">
          <span className="bg-canvas px-4 text-muted">or</span>
        </div>
      </div>

      <OAuthButton onClick={handleGoogleSignIn} isLoading={isGoogleLoading}>
        Continue with Google
      </OAuthButton>
    </form>
  );
}
