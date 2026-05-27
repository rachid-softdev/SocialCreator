"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { OAuthButton } from "./oauth-button";

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Auto-login after registration
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        // If auto-login fails, redirect to login
        router.push("/login");
      } else {
        router.push("/onboarding/cgu");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn("google", {
        callbackUrl: "/onboarding/cgu",
      });
    } catch (err) {
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
          <label htmlFor="name" className="block text-body-sm text-body mb-2">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-11 rounded-md border border-hairline-strong bg-surface-card px-4 text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-2 focus:border-ink transition-colors"
            placeholder="John Doe"
          />
        </div>

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
            minLength={8}
            className="w-full h-11 rounded-md border border-hairline-strong bg-surface-card px-4 text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-2 focus:border-ink transition-colors"
            placeholder="Min. 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-body-sm text-body mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full h-11 rounded-md border border-hairline-strong bg-surface-card px-4 text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-2 focus:border-ink transition-colors"
            placeholder="Confirm your password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-10 rounded-pill bg-primary text-on-primary font-medium text-button flex items-center justify-center hover:bg-primary-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Creating account..." : "Create Account"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-hairline" />
        </div>
        <div className="relative flex justify-center text-caption">
          <span className="bg-canvas px-4 text-muted">or</span>
        </div>
      </div>

      <OAuthButton onClick={handleGoogleSignIn} isLoading={isGoogleLoading} variant="outline">
        Continue with Google
      </OAuthButton>
    </form>
  );
}
