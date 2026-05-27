"use client";

import { cn } from "@socialcreator/utils";

interface BrandVoiceEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}

export function BrandVoiceEditor({
  value,
  onChange,
  maxLength = 500,
  placeholder = "Describe your brand's voice, tone, and personality. For example:\n\n- Friendly and approachable\n- Professional yet casual\n- Use emojis occasionally\n- Avoid technical jargon\n- References pop culture",
}: BrandVoiceEditorProps) {
  const charCount = value.length;
  const isNearLimit = charCount >= maxLength * 0.9;

  return (
    <div className="space-y-2">
      <label className="block text-body-sm text-body">Brand Voice</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={6}
        className={cn(
          "w-full rounded-md border bg-surface-card px-4 py-3 text-body-md text-ink placeholder:text-muted-soft resize-none",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isNearLimit
            ? "border-semantic-error"
            : "border-hairline-strong focus:border-primary-active",
        )}
      />
      <div className="flex justify-end">
        <span
          className={cn("text-caption", isNearLimit ? "text-semantic-error" : "text-muted-soft")}
        >
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}
