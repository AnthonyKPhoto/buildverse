"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Trash2, Plus, X, Activity, ScatterChart as ScatterChartIcon,
  TrendingUp, Eye, EyeOff,
} from "lucide-react";
import {
  LineChart, Line, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface TuneLogMeta {
  id: string;
  name: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

interface ParsedLog {
  meta: TuneLogMeta;
  headers: string[];
  rows: Record<string, number>[];
}

interface ActiveLog {
  id: string;
  xCol: string;
  yCol: string;
  y2Col: string;
  scatterX: string;
  scatterY: string;
  visible: boolean;
}

const COLORS = ["#7c3aed", "#f97316", "#22d3ee", "#facc15", "#4ade80", "#f472b6"];

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSVText(text: string): { headers: string[]; rows: Record<string, number>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const splitRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = splitRow(lines[0]);
  const rows: Record<string, number>[] = lines.slice(1).map((l) => {
    const cells = splitRow(l);
    const obj: Record<string, number> = {};
    headers.forEach((h, i) => {
      const v = parseFloat(cells[i] ?? "");
      if (!isNaN(v)) obj[h] = v;
    });
    return obj;
  }).filter((r) => Object.keys(r).length > 0);

  return { headers, rows };
}

// ── Upload panel ──────────────────────────────────────────────────────────────
function UploadPanel({ vehicleId, onUploaded }: { vehicleId: string; onUploaded: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pickFile = (f: File) => {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name || file.name);
      const res = await fetch(`/api/vehicles/${vehicleId}/tune-logs`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      toast({ title: "Log uploaded" });
      setFile(null);
      setName("");
      onUploaded();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card
      className={`border-dashed transition-colors ${dragging ? "border-theme bg-theme/5" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) pickFile(f);
      }}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col items-center py-4 gap-2 text-center">
          <Upload className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Drop a CSV data log here or</p>
          <input ref={fileRef} type="file" accept=".csv,.txt,.log" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Browse file</Button>
        </div>
        {file && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-theme shrink-0" />
              <span className="font-medium truncate">{file.name}</span>
              <span className="text-muted-foreground ml-auto shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => { setFile(null); setName(""); }}><X className="w-3 h-3" /></Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Log name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stage 2 tune — hot day" className="mt-1" />
            </div>
            <Button onClick={upload} disabled={uploading} className="w-full bg-theme hover:brightness-90">
              {uploading ? "Uploading…" : "Upload Log"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TuneLogsTab({ vehicleId }: { vehicleId: string }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<TuneLogMeta[]>([]);
  const [parsed, setParsed] = useState<Map<string, ParsedLog>>(new Map());
  const [active, setActive] = useState<Map<string, ActiveLog>>(new Map());
  const [showUpload, setShowUpload] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = () =>
    fetch(`/api/vehicles/${vehicleId}/tune-logs`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setLogs(data); });

  useEffect(() => { load(); }, [vehicleId]);

  const deleteLog = async (logId: string) => {
    if (!confirm("Delete this tune log?")) return;
    await fetch(`/api/vehicles/${vehicleId}/tune-logs/${logId}`, { method: "DELETE" });
    setParsed((p) => { const n = new Map(p); n.delete(logId); return n; });
    setActive((a) => { const n = new Map(a); n.delete(logId); return n; });
    load();
    toast({ title: "Log deleted" });
  };

  const toggleLog = async (log: TuneLogMeta) => {
    if (active.has(log.id)) {
      setActive((a) => { const n = new Map(a); n.delete(log.id); return n; });
      return;
    }

    if (parsed.has(log.id)) {
      const p = parsed.get(log.id)!;
      addActive(log.id, p.headers);
      return;
    }

    setLoadingId(log.id);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/tune-logs/${log.id}/content`);
      if (!res.ok) throw new Error();
      const text = await res.text();
      const { headers, rows } = parseCSVText(text);
      if (!headers.length) { toast({ title: "Couldn't parse CSV", variant: "destructive" }); return; }
      const p: ParsedLog = { meta: log, headers, rows };
      setParsed((prev) => new Map(prev).set(log.id, p));
      addActive(log.id, headers);
    } catch {
      toast({ title: "Failed to load log", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  const addActive = (id: string, headers: string[]) => {
    const defaultX = headers[0] ?? "";
    const defaultY = headers[1] ?? headers[0] ?? "";
    setActive((a) => new Map(a).set(id, {
      id,
      xCol: defaultX,
      yCol: defaultY,
      y2Col: headers[2] ?? "",
      scatterX: defaultX,
      scatterY: defaultY,
      visible: true,
    }));
  };

  const updateActive = (id: string, patch: Partial<ActiveLog>) =>
    setActive((a) => new Map(a).set(id, { ...a.get(id)!, ...patch }));

  const activeLogs = Array.from(active.entries()).map(([id, cfg]) => ({ cfg, p: parsed.get(id) })).filter((x) => x.p) as { cfg: ActiveLog; p: ParsedLog }[];

  // Merge rows for time-series by index (each log padded to common length)
  const maxRows = activeLogs.reduce((m, { p }) => Math.max(m, p.rows.length), 0);
  const mergedRows = Array.from({ length: maxRows }, (_, i) => {
    const obj: Record<string, number | undefined> = { _idx: i };
    activeLogs.forEach(({ cfg, p }) => {
      if (!cfg.visible) return;
      const row = p.rows[i];
      if (row) {
        obj[`${cfg.id}_x`] = row[cfg.xCol];
        obj[`${cfg.id}_y`] = row[cfg.yCol];
        if (cfg.y2Col && row[cfg.y2Col] !== undefined) obj[`${cfg.id}_y2`] = row[cfg.y2Col];
      }
    });
    return obj;
  });

  // XY scatter data per log
  const scatterData = (cfg: ActiveLog, p: ParsedLog) =>
    p.rows.map((r) => ({ x: r[cfg.scatterX], y: r[cfg.scatterY] })).filter((d) => d.x !== undefined && d.y !== undefined);

  const visibleLogs = activeLogs.filter(({ cfg }) => cfg.visible);

  if (logs.length === 0 && !showUpload) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Activity className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium mb-1">No tune logs yet</p>
            <p className="text-sm text-muted-foreground mb-4">Upload CSV data logs from your ECU tuning software</p>
            <Button onClick={() => setShowUpload(true)} size="sm" className="bg-theme hover:brightness-90">
              <Plus className="w-4 h-4 mr-1" /> Upload First Log
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{logs.length} log{logs.length !== 1 ? "s" : ""} · Click a log to load it into the viewer</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowUpload((s) => !s)}>
          <Upload className="w-3.5 h-3.5" />
          {showUpload ? "Hide upload" : "Upload log"}
        </Button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <UploadPanel vehicleId={vehicleId} onUploaded={() => { load(); setShowUpload(false); }} />
      )}

      {/* Log list */}
      <div className="space-y-2">
        {logs.map((log, i) => {
          const isActive = active.has(log.id);
          const isLoading = loadingId === log.id;
          const color = COLORS[i % COLORS.length];
          return (
            <Card
              key={log.id}
              className={`transition-colors cursor-pointer ${isActive ? "border-theme/50 bg-theme/5" : "hover:border-border/60"}`}
              onClick={() => toggleLog(log)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: isActive ? color : "var(--muted)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.name}</p>
                  <p className="text-xs text-muted-foreground">{log.originalName} · {(log.size / 1024).toFixed(1)} KB</p>
                </div>
                {isLoading && <div className="w-4 h-4 border-2 border-theme border-t-transparent rounded-full animate-spin shrink-0" />}
                {isActive && !isLoading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateActive(log.id, { visible: !active.get(log.id)?.visible }); }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Toggle visibility"
                  >
                    {active.get(log.id)?.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteLog(log.id); }}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="Delete log"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Viewer — only when at least one log is active */}
      {activeLogs.length > 0 && (
        <div className="space-y-4">
          {/* Per-log column selectors */}
          {activeLogs.map(({ cfg, p }, i) => (
            <Card key={cfg.id}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[logs.findIndex((l) => l.id === cfg.id) % COLORS.length] }} />
                  {p.meta.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-muted-foreground block mb-1">X axis (time-series)</label>
                    <select value={cfg.xCol} onChange={(e) => updateActive(cfg.id, { xCol: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                      {p.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Y axis (primary)</label>
                    <select value={cfg.yCol} onChange={(e) => updateActive(cfg.id, { yCol: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                      {p.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Y2 axis (optional)</label>
                    <select value={cfg.y2Col} onChange={(e) => updateActive(cfg.id, { y2Col: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">— none —</option>
                      {p.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-muted-foreground block mb-1">Scatter X</label>
                      <select value={cfg.scatterX} onChange={(e) => updateActive(cfg.id, { scatterX: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                        {p.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-muted-foreground block mb-1">Scatter Y</label>
                      <select value={cfg.scatterY} onChange={(e) => updateActive(cfg.id, { scatterY: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                        {p.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Charts */}
          <Tabs defaultValue="timeseries">
            <TabsList className="grid grid-cols-2 w-64">
              <TabsTrigger value="timeseries" className="gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5" /> Time Series
              </TabsTrigger>
              <TabsTrigger value="scatter" className="gap-1.5 text-xs">
                <ScatterChartIcon className="w-3.5 h-3.5" /> XY Scatter
              </TabsTrigger>
            </TabsList>

            {/* Time-series chart */}
            <TabsContent value="timeseries" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {visibleLogs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">All logs hidden — click the eye icon to show one</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={mergedRows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="_idx" tick={{ fontSize: 11, fill: "#888" }} label={{ value: "Sample index", position: "insideBottomRight", offset: -5, fontSize: 11, fill: "#888" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {visibleLogs.map(({ cfg, p }, i) => {
                          const color = COLORS[logs.findIndex((l) => l.id === cfg.id) % COLORS.length];
                          return [
                            <Line key={`${cfg.id}_y`} type="monotone" dataKey={`${cfg.id}_y`} name={`${p.meta.name} — ${cfg.yCol}`} stroke={color} dot={false} strokeWidth={1.5} />,
                            cfg.y2Col ? (
                              <Line key={`${cfg.id}_y2`} type="monotone" dataKey={`${cfg.id}_y2`} name={`${p.meta.name} — ${cfg.y2Col}`} stroke={color} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                            ) : null,
                          ];
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* XY scatter chart */}
            <TabsContent value="scatter" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {visibleLogs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">All logs hidden — click the eye icon to show one</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="x" type="number" name="X" tick={{ fontSize: 11, fill: "#888" }} />
                        <YAxis dataKey="y" type="number" name="Y" tick={{ fontSize: 11, fill: "#888" }} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {visibleLogs.map(({ cfg, p }) => {
                          const color = COLORS[logs.findIndex((l) => l.id === cfg.id) % COLORS.length];
                          return (
                            <Scatter
                              key={cfg.id}
                              name={`${p.meta.name} (${cfg.scatterX} vs ${cfg.scatterY})`}
                              data={scatterData(cfg, p)}
                              fill={color}
                              opacity={0.7}
                            />
                          );
                        })}
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
