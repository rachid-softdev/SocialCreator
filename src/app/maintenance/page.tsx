export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas px-4">
      <h1 className="text-4xl font-display font-bold text-ink mb-4">
        Under Maintenance
      </h1>
      <p className="text-lg text-muted mb-2 text-center max-w-md">
        We are currently performing scheduled maintenance. Please check back
        shortly.
      </p>
      <p className="text-sm text-muted/70">Expected downtime: minimal</p>
    </div>
  );
}
