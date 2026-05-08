"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface UploadButtonProps {
  onFileSelect: (file: File) => void;
  className?: string;
  accept?: string;
  disabled?: boolean;
}

export function UploadButton({
  onFileSelect,
  className,
  accept = "video/mp4,video/quicktime,video/webm",
  disabled = false,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [onFileSelect]
  );

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary font-medium text-button transition-all duration-200",
          "hover:bg-primary-active focus:ring-2 focus:ring-offset-2 focus:ring-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Upload className="w-4 h-4" />
        Upload Video
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}
