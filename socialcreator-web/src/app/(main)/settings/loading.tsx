/**
 * Settings page loading skeleton
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-surface-strong rounded" />
      <div className="h-4 w-64 bg-surface-strong rounded" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface-strong rounded-lg" />
        ))}
      </div>
    </div>
  );
}
