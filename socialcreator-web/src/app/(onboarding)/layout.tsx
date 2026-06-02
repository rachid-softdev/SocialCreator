import ErrorBoundary from "@/components/error-boundary";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}
