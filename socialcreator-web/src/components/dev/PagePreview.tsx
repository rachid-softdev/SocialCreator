"use client";

interface PagePreviewProps {
  src: string;
  title: string;
  height?: number;
}

export function PagePreview({ src, title, height = 600 }: PagePreviewProps) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-semantic-error/60" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/60" />
          <span className="h-3 w-3 rounded-full bg-semantic-success/60" />
        </div>
        <span className="text-caption text-muted ml-2 truncate">{title}</span>
      </div>
      <iframe
        src={src}
        title={title}
        className="w-full border-0"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
