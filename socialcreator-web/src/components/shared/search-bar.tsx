"use client";

import { cn } from "@socialcreator/utils";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  const isFirstRender = useRef(true);

  // Keep ref in sync
  onChangeRef.current = onChange;

  // Sync external value changes into local state
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce: call onChange 300ms after last user keystroke
  useEffect(() => {
    // Skip the initial render to avoid firing onChange on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      onChangeRef.current(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChangeRef.current("");
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 rounded-lg border border-hairline bg-surface-card text-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
