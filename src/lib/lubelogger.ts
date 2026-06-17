import { prisma } from "./prisma";

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

export async function loadConfig(): Promise<LubeLoggerConfig> {
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

function extractCookies(res: Response): string {
  const headers = res.headers as unknown as { getSetCookie?: () => string[] };
  const raw = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean) as string[];
  return raw.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

// Build auth headers; for basic auth we POST to /api/user/login and reuse the session cookie
export async function getAuthHeaders(cfg: LubeLoggerConfig): Promise<Record<string, string>> {
  const base = normaliseUrl(cfg.url);
  if (cfg.authType === "apikey" && cfg.apiKey) {
    return { Authorization: `Bearer ${cfg.apiKey}` };
  }
  if (cfg.authType === "basic" && cfg.username) {
    // Try JSON login first (/api/user/login with [FromBody])
    const res = await fetch(`${base}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cfg.username, password: cfg.password }),
      redirect: "manual",
    });

    // 404 = no built-in auth on this LubeLogger — proceed without credentials
    if (res.status === 404) return {};

    // If JSON login returns 401, try form-encoded to /Login/Index (browser form path)
    if (res.status === 401 || res.status === 403) {
      const formRes = await fetch(`${base}/Login/Index`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ UserName: cfg.username, Password: cfg.password }).toString(),
        redirect: "manual",
      });
      if (formRes.status === 401 || formRes.status === 403 || formRes.status === 404) {
        throw new Error(`Incorrect username or password. Use your LubeLogger login credentials (not Home Assistant or proxy credentials).`);
      }
      if (formRes.status >= 400) throw new Error(`LubeLogger login failed (${formRes.status})`);
      const formCookie = extractCookies(formRes);
      if (formCookie) return { Cookie: formCookie };
      throw new Error("Login succeeded but LubeLogger returned no session cookie — try API Key auth instead.");
    }

    if (res.status >= 400) throw new Error(`LubeLogger login failed (${res.status})`);

    // Extract only name=value pairs from Set-Cookie, stripping path/httponly/secure attributes
    const cookieString = extractCookies(res);
    if (!cookieString) {
      throw new Error("Login succeeded but LubeLogger returned no session cookie — try API Key auth instead.");
    }
    return { Cookie: cookieString };
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

export const LL_RECORD_TYPES = [
  { key: "servicerecords", label: "Service Records",  path: "/servicerecords" },
  { key: "oilchanges",     label: "Oil Changes",      path: "/oilchanges" },
  { key: "repairs",        label: "Repairs",          path: "/repairs" },
  { key: "tirerecords",    label: "Tire Records",     path: "/tirerecords" },
] as const;

export type LLRecordType = typeof LL_RECORD_TYPES[number]["key"];

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
    mileage: rec.mileage || null,
    cost: rec.cost || null,
    notes: notes || null,
    diy: false,
    externalId,
  };
}
