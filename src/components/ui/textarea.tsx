import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true the textarea expands automatically as the user types (default: true) */
  autoGrow?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoGrow = true, onChange, onFocus, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const combinedRef = (node: HTMLTextAreaElement | null) => {
      (innerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    };

    const grow = React.useCallback((el: HTMLTextAreaElement | null) => {
      if (!el || !autoGrow) return;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }, [autoGrow]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      grow(e.target);
      onChange?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      grow(e.target);
      onFocus?.(e);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          autoGrow ? "resize-none overflow-hidden" : "",
          className
        )}
        ref={combinedRef}
        onChange={handleChange}
        onFocus={handleFocus}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
