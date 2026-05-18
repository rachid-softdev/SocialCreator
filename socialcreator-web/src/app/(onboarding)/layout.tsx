export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      {children}
    </div>
  );
}