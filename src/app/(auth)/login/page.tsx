import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Left side - Hero band with gradient orb */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-canvas-soft overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Gradient orb decoration */}
          <div
            className="w-[500px] h-[500px] rounded-full opacity-60"
            style={{
              background: "radial-gradient(circle, var(--color-gradient-peach) 0%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <h1 className="text-display-xl font-display text-ink mb-6">
            Welcome back to SocialCreator
          </h1>
          <p className="text-body-md text-body max-w-md">
            Create, schedule, and publish your social media content with AI-powered automation.
            Connect your accounts and let the platform do the heavy lifting.
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-display-sm font-display text-ink mb-2">
              Sign In
            </h2>
            <p className="text-body text-muted">
              Enter your credentials to access your account
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-body-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-ink font-medium hover:underline transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}