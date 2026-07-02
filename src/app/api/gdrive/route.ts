import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CLIENT_ID     = "874903401741-bkbf6fjgq04583agk60o1vgi0iv4j34v.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET ?? "";
const DRIVE_API     = "https://www.googleapis.com/drive/v3";
const DRIVE_UP   = "https://www.googleapis.com/upload/drive/v3";
const FILE_NAME  = "buildverse-sync.json";

// ── Token helpers ──────────────────────────────────────────────────────────────

async function getValidToken(): Promise<string> {
  const [tokenRow, expiryRow, refreshRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "gdrive_access_token" } }),
    prisma.setting.findUnique({ where: { key: "gdrive_token_expiry" } }),
    prisma.setting.findUnique({ where: { key: "gdrive_refresh_token" } }),
  ]);
  if (!tokenRow) throw new Error("NOT_CONNECTED");

  const expiry = expiryRow ? parseInt(expiryRow.value) : 0;
  if (Date.now() < expiry - 5 * 60 * 1000) return tokenRow.value;
  if (!refreshRow) throw new Error("NO_REFRESH_TOKEN");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshRow.value,
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "TOKEN_REFRESH_FAILED");

  const newExpiry = Date.now() + ((data.expires_in as number) ?? 3600) * 1000;
  await Promise.all([
    prisma.setting.upsert({ where: { key: "gdrive_access_token" }, create: { key: "gdrive_access_token", value: data.access_token }, update: { value: data.access_token } }),
    prisma.setting.upsert({ where: { key: "gdrive_token_expiry" }, create: { key: "gdrive_token_expiry", value: String(newExpiry) }, update: { value: String(newExpiry) } }),
  ]);
  return data.access_token as string;
}

// ── Drive file helpers ─────────────────────────────────────────────────────────

async function findSyncFileId(token: string): Promise<string | null> {
  const res = await fetch(
    `${DRIVE_API}/files?spaces=appDataFolder&fields=files(id,name)&q=${encodeURIComponent(`name='${FILE_NAME}'`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  return (data.files as { id: string }[] | undefined)?.[0]?.id ?? null;
}

async function driveUpload(token: string, content: string): Promise<void> {
  const fileId  = await findSyncFileId(token);
  const meta    = JSON.stringify(fileId ? {} : { name: FILE_NAME, parents: ["appDataFolder"] });
  const boundary = "bv_mp_boundary";
  const body    = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

  const url    = fileId ? `${DRIVE_UP}/files/${fileId}?uploadType=multipart` : `${DRIVE_UP}/files?uploadType=multipart`;
  const method = fileId ? "PATCH" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `Drive upload failed: ${res.status}`);
  }
}

async function driveDownload(token: string): Promise<unknown> {
  const fileId = await findSyncFileId(token);
  if (!fileId) throw new Error("NO_SYNC_FILE");

  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.json();
}

// ── DB export / import ─────────────────────────────────────────────────────────

async function exportDB() {
  const [
    vehicles, modifications, modDependencies,
    maintenanceLogs, budgets, vehicleFiles,
    dynoRuns, tuneLogs, vehicleNotes, vehicleLinks,
    trackedProducts, priceHistory, receipts,
  ] = await Promise.all([
    prisma.vehicle.findMany(),
    prisma.modification.findMany(),
    prisma.modDependency.findMany(),
    prisma.maintenanceLog.findMany(),
    prisma.budget.findMany(),
    prisma.vehicleFile.findMany(),
    prisma.dynoRun.findMany(),
    prisma.tuneLog.findMany(),
    prisma.vehicleNote.findMany(),
    prisma.vehicleLink.findMany(),
    prisma.trackedProduct.findMany(),
    prisma.priceHistory.findMany(),
    prisma.receipt.findMany(),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    vehicles, modifications, modDependencies,
    maintenanceLogs, budgets, vehicleFiles,
    dynoRuns, tuneLogs, vehicleNotes, vehicleLinks,
    trackedProducts, priceHistory, receipts,
  };
}

function d(v: unknown): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v as string);
}
function dr(v: unknown): Date {
  return v instanceof Date ? v : new Date(v as string);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importDB(data: Record<string, any[]>) {
  const {
    vehicles = [], modifications = [], modDependencies = [],
    maintenanceLogs = [], budgets = [], vehicleFiles = [],
    dynoRuns = [], tuneLogs = [], vehicleNotes = [], vehicleLinks = [],
    trackedProducts = [], priceHistory = [], receipts = [],
  } = data;

  // Full replace inside a transaction
  await prisma.$transaction(async (tx) => {
    await tx.priceHistory.deleteMany();
    await tx.modDependency.deleteMany();
    await tx.modification.deleteMany();
    await tx.maintenanceLog.deleteMany();
    await tx.budget.deleteMany();
    await tx.vehicleFile.deleteMany();
    await tx.dynoRun.deleteMany();
    await tx.tuneLog.deleteMany();
    await tx.vehicleNote.deleteMany();
    await tx.vehicleLink.deleteMany();
    await tx.receipt.deleteMany();
    await tx.trackedProduct.deleteMany();
    await tx.vehicle.deleteMany();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (arr: any[], fn: (v: any) => any) => arr.map(fn);
    if (vehicles.length)      await tx.vehicle.createMany({       data: m(vehicles,      v => ({ ...v, createdAt: dr(v.createdAt), updatedAt: dr(v.updatedAt) })) });
    if (modifications.length) await tx.modification.createMany({  data: m(modifications, v => ({ ...v, createdAt: dr(v.createdAt), updatedAt: dr(v.updatedAt), installDate: d(v.installDate) })) });
    if (modDependencies.length) await tx.modDependency.createMany({ data: modDependencies });
    if (maintenanceLogs.length) await tx.maintenanceLog.createMany({ data: m(maintenanceLogs, v => ({ ...v, date: dr(v.date), createdAt: dr(v.createdAt), updatedAt: dr(v.updatedAt), nextDue: d(v.nextDue) })) });
    if (budgets.length)       await tx.budget.createMany({        data: m(budgets,       v => ({ ...v, createdAt: dr(v.createdAt), updatedAt: dr(v.updatedAt) })) });
    if (vehicleFiles.length)  await tx.vehicleFile.createMany({   data: m(vehicleFiles,  v => ({ ...v, uploadedAt: dr(v.uploadedAt) })) });
    if (dynoRuns.length)      await tx.dynoRun.createMany({       data: m(dynoRuns,      v => ({ ...v, date: dr(v.date), createdAt: dr(v.createdAt) })) });
    if (tuneLogs.length)      await tx.tuneLog.createMany({       data: m(tuneLogs,      v => ({ ...v, uploadedAt: dr(v.uploadedAt) })) });
    if (vehicleNotes.length)  await tx.vehicleNote.createMany({   data: m(vehicleNotes,  v => ({ ...v, createdAt: dr(v.createdAt), updatedAt: dr(v.updatedAt) })) });
    if (vehicleLinks.length)  await tx.vehicleLink.createMany({   data: m(vehicleLinks,  v => ({ ...v, createdAt: dr(v.createdAt) })) });
    if (trackedProducts.length) await tx.trackedProduct.createMany({ data: m(trackedProducts, v => ({ ...v, createdAt: dr(v.createdAt), updatedAt: dr(v.updatedAt), lastChecked: d(v.lastChecked) })) });
    if (priceHistory.length)  await tx.priceHistory.createMany({  data: m(priceHistory,  v => ({ ...v, createdAt: dr(v.createdAt) })) });
    if (receipts.length)      await tx.receipt.createMany({       data: m(receipts,      v => ({ ...v, createdAt: dr(v.createdAt), date: d(v.date) })) });
  }, { timeout: 60_000 });

  return {
    vehicles: vehicles.length, modifications: modifications.length,
    maintenanceLogs: maintenanceLogs.length, trackedProducts: trackedProducts.length,
  };
}

// ── Route handlers ─────────────────────────────────────────────────────────────

export async function GET() {
  const emailRow    = await prisma.setting.findUnique({ where: { key: "gdrive_user_email" } });
  const tokenRow    = await prisma.setting.findUnique({ where: { key: "gdrive_access_token" } });
  const lastSyncRow = await prisma.setting.findUnique({ where: { key: "gdrive_last_sync" } });

  if (!tokenRow) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    email:     emailRow?.value ?? "",
    lastSync:  lastSyncRow?.value ?? null,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action: string };

  if (action === "disconnect") {
    await prisma.setting.deleteMany({
      where: { key: { in: ["gdrive_access_token", "gdrive_refresh_token", "gdrive_token_expiry", "gdrive_user_email", "gdrive_last_sync"] } },
    });
    return NextResponse.json({ success: true });
  }

  try {
    const token = await getValidToken();

    if (action === "upload") {
      const data = await exportDB();
      await driveUpload(token, JSON.stringify(data));
      const now = new Date().toISOString();
      await prisma.setting.upsert({ where: { key: "gdrive_last_sync" }, create: { key: "gdrive_last_sync", value: now }, update: { value: now } });
      return NextResponse.json({ success: true, syncedAt: now });
    }

    if (action === "download") {
      const raw = await driveDownload(token) as Record<string, unknown[]>;
      const counts = await importDB(raw);
      const now = new Date().toISOString();
      await prisma.setting.upsert({ where: { key: "gdrive_last_sync" }, create: { key: "gdrive_last_sync", value: now }, update: { value: now } });
      return NextResponse.json({ success: true, imported: counts, syncedAt: now });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_CONNECTED") return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 401 });
    if (msg === "NO_SYNC_FILE") return NextResponse.json({ error: "No sync file found in Drive. Upload from this device first." }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
