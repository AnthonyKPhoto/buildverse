"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Link, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, label = "Photo", className }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(!value || value.startsWith("http"));
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDataUrl = value?.startsWith("data:");
  const isHttpUrl = value?.startsWith("http");
  const hasImage = !!value;

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    // Compress / resize before storing to keep DB size reasonable
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        onChange(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium leading-none">{label}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setUrlMode(false)}
            title="Upload a file"
            className={cn(
              "p-1 rounded transition-colors",
              !urlMode ? "text-theme" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            title="Enter a URL"
            className={cn(
              "p-1 rounded transition-colors",
              urlMode ? "text-theme" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Link className="w-3.5 h-3.5" />
          </button>
          {hasImage && (
            <button
              type="button"
              onClick={() => onChange("")}
              title="Remove image"
              className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {urlMode ? (
        /* ── URL input mode ─────────────────────────────────── */
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="url"
            placeholder="https://example.com/photo.jpg"
            value={isHttpUrl ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {isHttpUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="preview" className="w-9 h-9 rounded-md object-cover border border-border flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
        </div>
      ) : (
        /* ── Drag-drop / file upload mode ──────────────────── */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !hasImage && fileRef.current?.click()}
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-150 overflow-hidden",
            hasImage ? "border-theme/30 cursor-default" : "cursor-pointer hover:border-theme/50",
            dragging ? "border-theme bg-theme/5 scale-[1.01]" : "border-border",
          )}
          style={{ minHeight: hasImage ? 120 : 88 }}
        >
          {hasImage ? (
            /* Preview */
            <div className="relative w-full" style={{ minHeight: 120 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="preview"
                className="w-full object-cover rounded-[10px]"
                style={{ maxHeight: 200 }}
                onError={() => onChange("")}
              />
              {/* Change overlay */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-[10px] text-white text-xs font-medium"
              >
                <Upload className="w-5 h-5" />
                Change Photo
              </button>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center gap-2 py-5 px-4 text-center">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", dragging ? "bg-theme/20" : "bg-secondary")}>
                <ImageIcon className={cn("w-5 h-5 transition-colors", dragging ? "text-theme" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-medium">{dragging ? "Drop to upload" : "Drag & drop or click to browse"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP, GIF — resized to 800px max</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  );
}
