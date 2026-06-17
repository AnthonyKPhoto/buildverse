import { prisma } from "./prisma";
import { LL_RECORD_TYPES, LLRecordType } from "./lubelogger-constants";
import * as fs from "fs";
import * as path from "path";

export { LL_RECORD_TYPES };
export type { LLRecordType };

export interface LubeLoggerConfig {
  url: string;
  authType: "apikey" | "basic";
  apiKey: string;
  username: string;
  password: string;
  vehicleMap: Record<string, string>; // llVehicleId → bvVehicleId
  importTypes: string[];              // ["servicerecords","oilchanges","repairs","tirerecords"]
  syncInterval: "off" | "hourly" | "daily" | "weekly";
  lastSync: string | null;
}

const DEFAULT_CONFIG: LubeLoggerConfig = {
  url: "",
  authType: "apikey",
  apiKey: "",
  username: "",
  password: "",
  vehicleMap: {},
  importTypes: ["servicerecords", "oilchanges", "repairs"],
  syncInterval: "off",
  lastSync: null,
};

const SETTING_KEY = "lubelogger_config";

// In the packaged Electron app, BUILDVERSE_DATA_DIR is the user's AppData folder.
// Write settings to a JSON file there — avoids any Prisma ORM issues in production.
function settingsFilePath(): string | null {
  const dir = process.env.BUILDVERSE_DATA_DIR;
  if (!dir) return null;
  return path.join(dir, "lubelogger-config.json");
}

export async function loadConfig(): Promise<LubeLoggerConfig> {
  // File-based storage (packaged app)
  const filePath = settingsFilePath();
  if (filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(filePath, "utf-8")) };
      }
    } catch {}
  }
  // DB fallback (dev mode / migration from older versions)
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  if (!row) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(partial: Partial<LubeLoggerConfig>): Promise<LubeLoggerConfig> {
  const current = await loadConfig();
  const next = { ...current, ...partial };
  // File-based storage (packaged app)
  const filePath = settingsFilePath();
  if (filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(next), "utf-8");
    return next;
  }
  // DB fallback (dev mode)
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

// Normalise the base URL — keep only scheme+host+port, strip any path
export function normaliseUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return u.replace(/\/+$/, "");
  }
}

// Build auth headers for LubeLogger API calls.
// LubeLogger uses x-api-key header for API keys, and Authorization: Basic for username/password.
export async function getAuthHeaders(cfg: LubeLoggerConfig): Promise<Record<string, string>> {
  if (cfg.authType === "apikey" && cfg.apiKey) {
    return { "x-api-key": cfg.apiKey };
  }
  if (cfg.authType === "basic" && cfg.username) {
    const encoded = Buffer.from(`${cfg.username}:${cfg.password ?? ""}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }
  throw new Error("No credentials configured");
}

// Authenticated fetch against LubeLogger
export async function llFetch(cfg: LubeLoggerConfig, path: string): Promise<Response> {
  const base = normaliseUrl(cfg.url);
  const headers = await getAuthHeaders(cfg);
  return fetch(`${base}${path}`, { headers });
}

// Parse MM/DD/YYYY or YYYY-MM-DD or ISO dates from LubeLogger
export function parseLLDate(raw: string): Date {
  if (!raw) return new Date();
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
  // MM/DD/YYYY
  const parts = raw.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  return new Date(raw);
}

export interface LLVehicle {
  id: number;
  year: string;
  make: string;
  model: string;
  licensePlate: string;
  vin: string;
}

export interface LLRecord {
  id: number;
  date: string;
  mileage: number;
  description?: string;
  notes?: string;
  cost?: number;
  // oil-change specific
  oilBrand?: string;
  oilType?: string;
  oilFilter?: string;
  nextOilChange?: number;
  // tire specific
  frontLeft?: string;
  frontRight?: string;
}


function parseFloat2(val: unknown): number | null {
  if (val == null) return null;
  const n = parseFloat(String(val));
  return isNaN(n) || !isFinite(n) ? null : n;
}

function parseInt2(val: unknown): number | null {
  if (val == null) return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

// Map a LubeLogger record to a BuildVerse MaintenanceLog payload
export function mapRecord(
  rec: LLRecord,
  type: LLRecordType,
  llVehicleId: number,
  bvVehicleId: string
): {
  vehicleId: string; service: string; date: Date; mileage: number | null;
  cost: number | null; notes: string | null; diy: boolean; externalId: string;
} {
  const externalId = `ll:${llVehicleId}:${type}:${rec.id}`;

  let service = rec.description || "";
  let notes = rec.notes || "";

  if (type === "oilchanges") {
    service = service || "Oil Change";
    const oilParts = [rec.oilBrand, rec.oilType, rec.oilFilter].filter(Boolean).join(" · ");
    if (oilParts) notes = [oilParts, notes].filter(Boolean).join(" — ");
    if (rec.nextOilChange) notes = [notes, `Next at ${rec.nextOilChange.toLocaleString()} mi`].filter(Boolean).join(" | ");
  }

  if (type === "tirerecords") {
    service = service || "Tire Service";
    const tireInfo = [rec.frontLeft, rec.frontRight].filter((v, i, a) => v && a.indexOf(v) === i).join(" / ");
    if (tireInfo) notes = [tireInfo, notes].filter(Boolean).join(" — ");
  }

  if (type === "servicerecords" && !service) service = "Service";
  if (type === "repairs" && !service) service = "Repair";

  return {
    vehicleId: bvVehicleId,
    service,
    date: parseLLDate(rec.date),
    mileage: parseInt2(rec.mileage),
    cost: parseFloat2(rec.cost),
    notes: notes || null,
    diy: false,
    externalId,
  };
}
