import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas px-4">
      <h1 className="text-6xl font-display font-bold text-ink mb-4">404</h1>
      <p className="text-xl text-muted mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
