"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Link, Image as ImageIcon, Crop, ZoomIn, ZoomOut, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Output crop aspect ratio — width/height (e.g. 16/9). Omit for free-form. */
  aspect?: number;
  className?: string;
}

// ─── Crop modal ──────────────────────────────────────────────────────────────

interface CropModalProps {
  src: string;
  aspect?: number;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

function CropModal({ src, aspect, onConfirm, onCancel }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // zoom: 1 = fit-to-container, higher = zoomed in
  const [zoom, setZoom] = useState(1);
  // offset in *image* pixels (what part of the image is centered)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Dimensions ──────────────────────────────────────────────────────────────
  const PREVIEW_W = 480;
  const PREVIEW_H = aspect ? Math.round(PREVIEW_W / aspect) : 320;

  // Once src loads, centre the image
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setOffset({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
      setZoom(1);
      draw(img, 1, { x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(
    (img: HTMLImageElement, z: number, off: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      canvas.width = PREVIEW_W;
      canvas.height = PREVIEW_H;

      // How many image pixels fit in the preview at this zoom
      const visW = PREVIEW_W / z;
      const visH = PREVIEW_H / z;

      // Source rect clamped to image bounds
      let sx = off.x - visW / 2;
      let sy = off.y - visH / 2;
      // Clamp
      sx = Math.max(0, Math.min(sx, img.naturalWidth - visW));
      sy = Math.max(0, Math.min(sy, img.naturalHeight - visH));
      // If visible area > image dimension, center it
      if (visW >= img.naturalWidth) { sx = 0; }
      if (visH >= img.naturalHeight) { sy = 0; }
      const sw = Math.min(visW, img.naturalWidth);
      const sh = Math.min(visH, img.naturalHeight);

      ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PREVIEW_W, PREVIEW_H);

      // Overlay guidelines
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const x = (PREVIEW_W / 3) * i;
        const y = (PREVIEW_H / 3) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PREVIEW_H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PREVIEW_W, y); ctx.stroke();
      }
      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);
    },
    [PREVIEW_H, PREVIEW_W]
  );

  // Redraw on zoom/offset change
  useEffect(() => {
    if (imgRef.current) draw(imgRef.current, zoom, offset);
  }, [zoom, offset, draw]);

  // ── Drag to pan ─────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !imgRef.current) return;
      const img = imgRef.current;
      const visW = PREVIEW_W / zoom;
      const visH = PREVIEW_H / zoom;
      // Movement in image pixels
      const dx = ((e.clientX - dragStart.current.mx) / PREVIEW_W) * visW;
      const dy = ((e.clientY - dragStart.current.my) / PREVIEW_H) * visH;
      const nx = Math.max(visW / 2, Math.min(img.naturalWidth - visW / 2, dragStart.current.ox - dx));
      const ny = Math.max(visH / 2, Math.min(img.naturalHeight - visH / 2, dragStart.current.oy - dy));
      setOffset({ x: nx, y: ny });
    },
    [dragging, zoom, PREVIEW_W, PREVIEW_H]
  );
  const onMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  // ── Zoom via scroll ─────────────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(10, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  // ── Confirm: export the canvas as JPEG ─────────────────────────────────────
  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Export at 2× for retina quality, then cap to 1200px
    const OUT_W = Math.min(PREVIEW_W * 2, 1200);
    const OUT_H = Math.round(OUT_W * (PREVIEW_H / PREVIEW_W));
    const out = document.createElement("canvas");
    out.width = OUT_W;
    out.height = OUT_H;
    out.getContext("2d")!.drawImage(canvas, 0, 0, OUT_W, OUT_H);
    onConfirm(out.toDataURL("image/jpeg", 0.88));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-theme" />
            <h3 className="font-semibold text-sm">Crop Photo</h3>
          </div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas preview */}
        <div
          ref={containerRef}
          className={cn("relative rounded-xl overflow-hidden select-none border border-border bg-black", dragging ? "cursor-grabbing" : "cursor-grab")}
          style={{ width: PREVIEW_W, maxWidth: "100%", aspectRatio: `${PREVIEW_W}/${PREVIEW_H}` }}
          onMouseDown={onMouseDown}
          onWheel={onWheel}
        >
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%" }}
          />
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/60 pointer-events-none select-none">Drag to pan · scroll to zoom</p>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 1.2))} className="text-muted-foreground hover:text-foreground">
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range" min={1} max={10} step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[hsl(var(--theme))]"
          />
          <button type="button" onClick={() => setZoom((z) => Math.min(10, z * 1.2))} className="text-muted-foreground hover:text-foreground">
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(1)}×</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="button" onClick={confirm} className="px-4 py-2 text-sm rounded-lg bg-theme text-white font-medium hover:brightness-110 transition-all flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Use Photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ImageUpload component ───────────────────────────────────────────────

export function ImageUpload({ value, onChange, label = "Photo", aspect, className }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(!value || value.startsWith("http"));
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isHttpUrl = value?.startsWith("http");
  const hasImage = !!value;

  // Load file → open crop modal
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setCropSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const handleCropConfirm = (dataUrl: string) => {
    onChange(dataUrl);
    setCropSrc(null);
    setUrlMode(false);
  };

  return (
    <>
      {/* Crop modal */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          aspect={aspect}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className={cn("space-y-2", className)}>
        {/* Label row */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium leading-none">{label}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setUrlMode(false)}
              title="Upload a file"
              className={cn("p-1 rounded transition-colors", !urlMode ? "text-theme" : "text-muted-foreground hover:text-foreground")}
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setUrlMode(true)}
              title="Enter a URL"
              className={cn("p-1 rounded transition-colors", urlMode ? "text-theme" : "text-muted-foreground hover:text-foreground")}
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
              <div className="flex flex-col items-center justify-center gap-2 py-5 px-4 text-center">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", dragging ? "bg-theme/20" : "bg-secondary")}>
                  <ImageIcon className={cn("w-5 h-5 transition-colors", dragging ? "text-theme" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-sm font-medium">{dragging ? "Drop to upload" : "Drag & drop or click to browse"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP — crop &amp; resize before saving</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>
    </>
  );
}
