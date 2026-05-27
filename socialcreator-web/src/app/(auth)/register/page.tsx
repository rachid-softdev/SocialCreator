import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Left side - Hero band with gradient orb */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-canvas-soft overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Gradient orb decoration */}
          <div
            className="w-[500px] h-[500px] rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, var(--color-gradient-lavender) 0%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <h1 className="text-display-xl font-display text-ink mb-6">Join SocialCreator</h1>
          <p className="text-body-md text-body max-w-md">
            Start creating and scheduling your social media content with the power of AI. Connect
            your accounts and automate your content strategy.
          </p>
        </div>
      </div>

      {/* Right side - Register form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-display-sm font-display text-ink mb-2">Create Account</h2>
            <p className="text-body text-muted">Fill in your details to get started</p>
          </div>

          <RegisterForm />

          <p className="mt-8 text-center text-body-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-ink font-medium hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
