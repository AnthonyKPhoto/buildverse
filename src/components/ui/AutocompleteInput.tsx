"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  maxSuggestions?: number;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  maxSuggestions = 8,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions to those that start with or contain the typed text
  const filtered = value.trim().length === 0
    ? []
    : suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
        .sort((a, b) => {
          // Prioritise prefix matches
          const aStarts = a.toLowerCase().startsWith(value.toLowerCase());
          const bStarts = b.toLowerCase().startsWith(value.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
        .slice(0, maxSuggestions);

  const accept = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Tab" || e.key === "Enter") {
      // Tab or Enter accepts the highlighted suggestion (or the first one)
      const target = activeIndex >= 0 ? filtered[activeIndex] : filtered[0];
      if (target) {
        e.preventDefault();
        accept(target);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {/* Tab hint */}
      {open && filtered.length > 0 && activeIndex < 0 && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none select-none">
          Tab ↵
        </span>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-y-auto max-h-52 py-1"
        >
          {filtered.map((s, i) => {
            const isActive = i === activeIndex;
            // Bold the matching portion
            const matchStart = s.toLowerCase().indexOf(value.toLowerCase());
            const before = s.slice(0, matchStart);
            const match  = s.slice(matchStart, matchStart + value.length);
            const after  = s.slice(matchStart + value.length);

            return (
              <li
                key={s}
                className={cn(
                  "px-3 py-1.5 text-sm cursor-pointer select-none",
                  isActive
                    ? "bg-theme/15 text-foreground"
                    : "text-foreground hover:bg-secondary"
                )}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur before accept
                  accept(s);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {before}
                <span className="font-semibold text-theme">{match}</span>
                {after}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
