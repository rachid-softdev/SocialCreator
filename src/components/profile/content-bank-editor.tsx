"use client";

interface ContentBankEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ContentBankEditor({
  value,
  onChange,
  placeholder = "Paste examples of your past content here. This helps the AI understand your style:\n\n- Previous social posts\n- Blog articles\n- Newsletter snippets\n- Any content that represents your brand",
}: ContentBankEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-body-sm text-body">Content Bank</label>
        <span className="text-caption text-muted-soft">(optional)</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full rounded-md border border-hairline-strong bg-surface-card px-4 py-3 text-body-md text-ink placeholder:text-muted-soft resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:border-primary-active"
      />
      <p className="text-caption text-muted-soft">
        Tip: Paste examples of content that represents you to improve generation quality.
      </p>
    </div>
  );
}