"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Trash2, Download, FileText, FileImage, File,
  X, Loader2, Eye, AlertCircle,
} from "lucide-react";

interface VehicleFile {
  id: string;
  vehicleId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface Props {
  vehicleId: string;
}

const ACCEPT = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
].join(",");

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/"))        return <FileImage className="w-5 h-5 text-blue-400" />;
  if (mime === "application/pdf")        return <FileText className="w-5 h-5 text-red-400" />;
  if (mime === "text/plain")             return <FileText className="w-5 h-5 text-muted-foreground" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function typeBadge(mime: string): string {
  if (mime.startsWith("image/"))  return "Image";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word"))      return "Word";
  if (mime === "text/plain")      return "Text";
  return "File";
}

function canPreview(mime: string): boolean {
  return mime.startsWith("image/") || mime === "application/pdf" || mime === "text/plain";
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({ file, onClose }: { file: VehicleFile; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const contentUrl = `/api/vehicles/${file.vehicleId}/files/${file.id}/content`;

  useEffect(() => {
    if (file.mimeType !== "text/plain") return;
    fetch(contentUrl)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("Could not load file."));
  }, [file, contentUrl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
        style={{ maxWidth: "min(90vw, 1100px)", maxHeight: "90vh", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileIcon mime={file.mimeType} />
            <span className="text-sm font-medium truncate">{file.originalName}</span>
            <span className="text-xs text-muted-foreground shrink-0">({formatBytes(file.size)})</span>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <a
              href={contentUrl}
              download={file.originalName}
              className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto" style={{ maxHeight: "calc(90vh - 57px)" }}>
          {file.mimeType.startsWith("image/") && (
            <img
              src={contentUrl}
              alt={file.originalName}
              className="max-w-full h-auto block mx-auto"
            />
          )}
          {file.mimeType === "application/pdf" && (
            <iframe
              src={contentUrl}
              title={file.originalName}
              className="w-full border-none"
              style={{ height: "calc(90vh - 57px)", minHeight: 400 }}
            />
          )}
          {file.mimeType === "text/plain" && (
            <div className="p-5">
              {text === null ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {text}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VehicleFilesTab({ vehicleId }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<VehicleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<VehicleFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/files`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load files", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [vehicleId, toast]);

  useEffect(() => { load(); }, [load]);

  const uploadFile = useCallback(async (file: File) => {
    const allowed = ACCEPT.split(",");
    if (!allowed.includes(file.type)) {
      toast({ title: `${file.name} — unsupported type`, description: "Images, PDF, Word, or TXT only.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: `${file.name} too large`, description: "Max 50 MB per file.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/vehicles/${vehicleId}/files`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const record: VehicleFile = await res.json();
      setFiles((prev) => [record, ...prev]);
      toast({ title: `${file.name} uploaded` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [vehicleId, toast]);

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach(uploadFile);
  }, [uploadFile]);

  // Drag and drop
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const deleteFile = async (f: VehicleFile) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/files/${f.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      if (preview?.id === f.id) setPreview(null);
      toast({ title: `${f.originalName} deleted` });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 ${
          dragging
            ? "border-theme bg-theme/8 scale-[1.01]"
            : "border-border hover:border-theme/50 hover:bg-secondary/30"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        style={{ cursor: uploading ? "default" : "pointer" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center pointer-events-none select-none">
          {uploading ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-theme/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-theme animate-spin" />
              </div>
              <p className="text-sm font-medium">Uploading…</p>
            </>
          ) : (
            <>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-theme/20" : "bg-secondary"}`}>
                <Upload className={`w-6 h-6 transition-colors ${dragging ? "text-theme" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-medium">{dragging ? "Drop to upload" : "Drag files here or click to browse"}</p>
                <p className="text-xs text-muted-foreground mt-1">Images, PDF, Word, TXT · Max 50 MB each</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading files…</span>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No files yet — upload receipts, manuals, photos, or any document</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary/40 transition-colors"
            >
              {/* Thumbnail or icon */}
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                {f.mimeType.startsWith("image/") ? (
                  <img
                    src={`/api/vehicles/${vehicleId}/files/${f.id}/content`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileIcon mime={f.mimeType} />
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {typeBadge(f.mimeType)} · {formatBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canPreview(f.mimeType) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setPreview(f)}
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                )}
                <a
                  href={`/api/vehicles/${vehicleId}/files/${f.id}/content`}
                  download={f.originalName}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:text-destructive"
                  onClick={() => deleteFile(f)}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
