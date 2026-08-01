# BuildVerse — Claude Code Handoff

## What this is
A local-first vehicle modification manager. Users plan, track, budget, and share car builds.
Think PCPartPicker + Trello + Notion, but for automotive mods.

**GitHub:** https://github.com/AnthonyKPhoto/buildverse  
**Current version:** see `package.json` → `version`  
**Live self-hosted instance:** https://buildverse.kaiserhomelab.net

---

## Three ways to run

| Mode | Command | Port | Notes |
|------|---------|------|-------|
| Dev (browser) | `npm run dev` | 3000 | Hot-reload, use this for all development |
| Electron desktop | `npm run electron:dev` | 3000→app window | Wraps the Next.js server in a native window |
| Docker / self-hosted | `docker compose up` | 3456 | Uses `ghcr.io/anthonykphoto/buildverse:latest` |

Dev server auto-reloads — no restart needed when editing source files.

---

## Tech stack

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, Radix UI primitives
- **Database:** SQLite via Prisma ORM (`prisma/buildverse.db` for dev, `/data/buildverse.db` in Docker)
- **Theming:** CSS `--theme` variable controlled by `ThemeProvider` from localStorage. All accent classes use `text-theme`, `bg-theme`, `border-theme` — never hardcode `orange-*` for primary actions.
- **Electron:** `electron/main.js` spawns the Next.js standalone server on port 3456, opens a `BrowserWindow`. Packaged with `electron-builder` → `dist-electron/`.
- **Docker:** `Dockerfile` builds Next.js standalone output; `docker-compose.yml` wires volume + env vars.

---

## Key directories

```
src/
  app/
    api/                  All Next.js API routes
      vehicles/[id]/      CRUD + nested resources (mods, budget, maintenance, files, dyno, tune-logs, links, notes, recalls)
      modifications/[id]/ PUT (update) + DELETE (also cleans ModDependency rows)
      products/           Tracked product scraping + price history + alerts
      auth/               Login/logout/me/setup/setup-status/change-password — per-user, cookie-based session (see Authentication below)
      admin/              Admin-only: users CRUD, vehicle-access grants, settings/smtp, restore-db (raw .db OR .zip transfer pack, server mode only)
      user/theme/         Self-only PUT of the signed-in account's own appearance prefs
      health/             Unauthenticated status/mode endpoint (Docker healthcheck + client mode detection)
      integrations/lubelogger/  LubeLogger pull sync
      stats/              Dashboard aggregate counts
      builds/             Cross-vehicle mod list
      search/             Global search
      suggestions/        Autocomplete suggestions
      sync/               Generic sync trigger (consumed by the Capacitor/Android app, not the desktop UI)
      wipe/               Factory reset
    garage/[id]/          Vehicle detail page (tabs: Mods, Maintenance, Budget, Dyno, Tune Logs, Files, Notes, Links)
    builds/               Cross-vehicle mod list
    budget/               Budget planner with charts
    products/             Product tracker / price monitoring
    maintenance/          Global maintenance log
    vendors/              Static vendor directory
    settings/             App settings, theme, data management, Access & Sync (server connection, account, users)
    login/                Server-mode login page — AuthGate branches between LoginForm and SetupForm (first-run self-service admin)
    change-password/      Forced password-change page (temp-password accounts) — also reachable voluntarily
  components/
    layout/               Sidebar, BottomNav (mobile), GlobalSearch
    modifications/        AddModDialog, CSVImportDialog
    maintenance/          AddMaintenanceDialog
    vehicles/             AddVehicleDialog, KanbanView, BuildSheetPDF, PDFExportDialog,
                          DynoTab, TuneLogsTab, VehicleFilesTab, NoteBoard, LinksTab
    ui/                   Radix-based primitives (button, card, badge, dialog, select, tabs…)
    ThemeProvider.tsx     Accent color management
    SetupWizard.tsx       First-run onboarding
  lib/
    prisma.ts             Singleton Prisma client
    utils.ts              Shared helpers — formatCurrency, calcTotalModValue, MOD_STATUSES, EXCLUDED_FROM_VALUE, etc.
    scraper.ts            Product URL scraper (cheerio via undici, SSRF-guarded + DNS-rebinding pinned)
    lubelogger.ts         LubeLogger API client
    auth/password.ts       scrypt hash/verify + isAuthEnabled() + generateTempPassword() (Node-only, never import from middleware.ts)
    auth/session.ts        Signed session cookie (jose, Edge-safe) carrying {userId, username, role, mustChangePassword}
    auth/vehicle-access.ts canEditVehicle() — per-vehicle edit permission check, called from mutating vehicle sub-resource routes
    mailer.ts              nodemailer wrapper + SMTP config storage (Setting table key "smtp"), used for temp-password emails
  middleware.ts           Auth gate — loopback always bypasses (Electron's own spawned server); remote requires a valid per-user session; forces mustChangePassword accounts to /change-password
  hooks/
    use-toast.ts
    use-categories.ts     Dynamic category list from API
prisma/
  schema.prisma           Single source of truth for DB schema
  buildverse.db           Dev database (gitignored)
  seed.ts                 Sample data seeder
electron/
  main.js                 Electron main process
  preload.js              Context bridge
```

---

## Database models (Prisma / SQLite)

| Model | Key fields | Notes |
|-------|-----------|-------|
| `Vehicle` | year, make, model, trim, engine, transmission, drivetrain, vin, mileage, platform, color, photoUrl, instagramUrl, facebookUrl, notes | photoUrl accepts `data:image/` base64 or https:// |
| `Modification` | name, category, vendor, brand, price, actualPrice, status, priority, link, imageUrl, difficulty, installDate, installMileage, laborCost, diyInstall, partNumber, orderNumber | Cascade-deleted with vehicle |
| `ModDependency` | modId, dependsOnId | Many-to-many self-ref. **Must** delete these before deleting a Modification (SQLite doesn't cascade FK automatically — see `DELETE /api/modifications/[id]`) |
| `TrackedProduct` | url (unique), title, currentPrice, lowestPrice, highestPrice, alertThreshold, vendor, priceHistory[] | |
| `Budget` | vehicleId, category (unique pair), planned, actual | upsert by vehicleId+category |
| `MaintenanceLog` | service, date, mileage, cost, shop, diy, nextDue, nextMiles, externalId | externalId used for LubeLogger dedup |
| `DynoRun` | hp, torque, label, date | |
| `VehicleFile` | filename, originalName, mimeType, size | Binary stored on filesystem via API |
| `TuneLog` | name, filename, originalName, size | |
| `VehicleNote` | title, content, color, importance | Sticky-note board |
| `VehicleLink` | title, url, description, category | External links per vehicle |
| `Setting` | key, value | App-wide key/value store (custom categories, LubeLogger config, SMTP config under key `"smtp"`) |
| `User` | username (unique), email, passwordHash, role (admin\|member), mustChangePassword, accentColor, radius, font, colorScheme | Server mode only — see Authentication below. Everyone shares the same garage; this is per-person login identity, not data isolation. Theme fields are this account's own saved appearance (see "Per-user theme"). |
| `VehicleAccess` | vehicleId, userId (unique pair) | Explicit "this user may edit this vehicle" grant set by an admin. `Vehicle.createdByUserId` (nullable, `SetNull` on user delete) tracks the creator, who always keeps edit access alongside admins and anyone with a grant. |

**Schema changes:** edit `prisma/schema.prisma` then run `npx prisma db push`. No migrations needed (SQLite + `db push`).

---

## Mod statuses & value rules

```ts
// src/lib/utils.ts
export const EXCLUDED_FROM_VALUE = new Set(["RESEARCHING", "REMOVED"]);
```

- `RESEARCHING` is displayed as **"Researching / Idea"** everywhere — it's a brainstorm bucket, not a commitment.
- `RESEARCHING` and `REMOVED` are **excluded from all build value totals** (stats API, builds page, garage cards, vehicle detail category totals).
- `calcTotalModValue()` in `utils.ts` is the canonical helper — use it instead of inline reduces.
- Build completion % (`calcBuildCompletion`) counts RESEARCHING toward the denominator (intentional — it shows how much is still "not done").

**Statuses in order:** PLANNED → RESEARCHING → ORDERED → PURCHASED → INSTALLED → REMOVED

**Priorities:** NONE (default), LOW, MEDIUM, HIGH, CRITICAL

---

## Authentication

Real per-user accounts (`User` table: username, scrypt password hash, admin/member role) — this
replaced an earlier single-shared-password + Google-login scheme, and Google Drive sync (separate
OAuth) has been removed entirely in favor of the server itself being the single source of truth
(see "Server-as-source-of-truth" below).

Auth is entirely **inert** unless `AUTH_SESSION_SECRET` is set (i.e. local dev and Electron's local
mode are never affected). When it is set (Docker/server deployments):

- Loopback (`127.0.0.1`, `::1`) always bypasses — this is Electron's own spawned local server talking
  to itself, not a real remote client. It is **not** a subnet/LAN check: a phone on the same Wi-Fi is
  not loopback and still has to sign in as a real user.
- Everyone else needs a valid session cookie (`bv_session`, signed via `AUTH_SESSION_SECRET` — see
  `src/lib/auth/session.ts`), or gets redirected to `/login` (pages) / 401 (API routes).
- `src/middleware.ts` verifies the JWT and, on success, attaches `x-user-id` / `x-user-username` /
  `x-user-role` headers to the request for downstream routes to trust — it strips any client-supplied
  copies of those headers first, so they can't be spoofed.

**First admin — two ways, and they compose:**
1. **Self-service (default):** the first time anyone visits a fresh server with zero `User` rows, the
   login page (`src/app/login/AuthGate.tsx`, driven by `GET /api/auth/setup-status`) shows a
   "create the admin account" form instead of a login form (`POST /api/auth/setup`). Whoever submits
   it first becomes admin — race-safe via a `$transaction` count-then-create, but note this means
   whoever reaches a freshly-deployed empty server first gets the admin slot, so complete setup
   promptly after first boot (or pre-provision below if that window is a concern).
2. **Pre-provisioned (optional):** set `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` before first boot and
   `scripts/docker-init-db.js` bootstraps that specific account instead — this also re-runs
   (self-healing) if the `User` table ever ends up with zero admins, e.g. after restoring an old
   Electron backup via `/api/admin/restore-db` that predates the `User` table.

Every other account (including more admins) is created afterward from **Settings → Access & Sync →
Users**, admin-only — either with a password the admin types directly, or (if an email is given
instead) an auto-generated temp password emailed via the SMTP settings on that same page
(`src/lib/mailer.ts`, config stored in the `Setting` table). A temp-password account gets
`mustChangePassword: true` and is forced to `/change-password` (`src/middleware.ts`) before it can do
anything else; submitting a new password there (`POST /api/auth/change-password`) clears the flag and
issues a fresh session token — no re-login needed.

**Login:** POST `/api/auth/login` with `{ username, password }`.
**Current user:** GET `/api/auth/me` (reads the headers middleware already attached, plus the user's
saved theme fields straight from the DB — see "Per-user theme" below).

**Per-vehicle edit access:** viewing the garage is always shared. Editing a given vehicle (and its
mods/maintenance/budget/etc.) requires being an admin, that vehicle's creator (`Vehicle.createdByUserId`,
set from `x-user-id` at creation time), or holding an explicit `VehicleAccess` grant — see
`src/lib/auth/vehicle-access.ts`'s `canEditVehicle()`, called from every mutating vehicle sub-resource
route. Admins manage grants from **Settings → Access & Sync → Vehicle Access**
(`GET/POST/DELETE /api/admin/vehicle-access`).

---

## Server-as-source-of-truth (replaces the old Google Drive / WebDAV / "BuildVerse Server" picker)

The desktop Settings → Access & Sync tab used to offer a Google Drive / WebDAV / "BuildVerse Server"
sync-method picker. That's gone. The model now: a self-hosted Docker server is the one live database;
the Electron desktop app can either stay fully local (default, unchanged) or switch to **Connect to
Server** mode, in which case it skips spawning its own local server entirely and just points its
`BrowserWindow` at the remote server URL — every `fetch()` in the app already uses relative URLs, so
this required zero data-layer changes, only a navigation/origin change in `electron/main.js`
(`serverMode`/`serverUrl` in `prefs.json`, `server:testConnection` IPC to check reachability from the
main process so it isn't blocked by CORS).

**Migrating existing local data onto a server:** two options from Electron, both uploaded via
**Settings → Access & Sync → Server Data** (admin-only, requires re-entering the admin's own
password) — `POST /api/admin/restore-db` accepts either and auto-detects which by magic bytes:
- **Settings → Backups → New Backup** produces a raw `.db` file — database only, no file attachments.
- **Settings → Backups → Export Transfer Pack** produces a `.zip` (db + `vehicle-files/` +
  `tune-logs/`, the two tables whose content lives on disk rather than in the SQLite file — see
  `VehicleFile`/`TuneLog` below). Use this one if the install being migrated has any uploaded
  documents or tune logs, or those attachments become dead references on the server.

Both do a full destructive replace — use this once for your own primary migration, not for adding a
second person's cars. For that (any signed-in user, not admin-only): `POST /api/import-zip`
(Settings → Data & Backup → **Add Vehicles from Transfer Pack**) is the additive counterpart —
same zip format, but reads the source db into a scratch copy and re-creates each vehicle (plus
everything under it: mods, dependencies, maintenance, budgets, dyno runs, links, notes, and the
actual file bytes for `VehicleFile`/`TuneLog`, all with freshly generated IDs) as new records owned
by the importing user, never touching what's already on the server. Deliberately out of scope:
`TrackedProduct`/`Receipt` (global, not per-vehicle) and `VehicleAccess` grants (reference source-
install user IDs that don't exist here). This is what the plain JSON export/import can't do, since
it neither carries `VehicleFile`/`TuneLog` attachments nor is a single file to hand someone.

Electron's zip export (`electron/main.js`, `transfer:export-zip`) shells out to PowerShell's
`ZipFile.CreateFromDirectory`, which on Windows stores entry names with **backslash** separators
(`vehicle-files\veh1\photo.jpg`), not the forward slashes the ZIP format conventionally uses —
confirmed by building one and inspecting it, not assumed. `src/lib/transfer-pack.ts` (shared by
both `restore-db` and `import-zip`) normalizes every entry name before any path matching; don't
reintroduce a raw `.startsWith("vehicle-files/")` check without that normalization, or it will
silently match nothing on a real Windows-exported pack.

**`BUILDVERSE_DATA_DIR` must be set for Docker** (`docker-compose.yml` sets it to `/data`, the
mounted volume) — `vehicle-files`/`tune-logs` uploads are written under this directory (or
`process.cwd()/data` if unset, which in the container is inside the writable layer, **not** the
volume, and gets silently wiped on every image update). Electron sets this itself
(`app.getPath("userData")`); it's only Docker that needs the explicit env var.

**Note on WAL mode:** the server enables SQLite WAL mode for concurrent multi-client writes
(`scripts/docker-init-db.js`). If you ever back up the live server's volume by copying the `.db` file
directly (rather than through the app's own restore-db flow), run `PRAGMA wal_checkpoint(FULL);`
first, or copy the `.db-wal`/`.db-shm` sidecar files too — otherwise the copy can be missing recent
writes that are still sitting in the WAL file.

**Android/Capacitor app:** `capacitor-app/sync.js` still talks to `GET`/`POST /api/sync` directly
(untouched by this rework) — that endpoint's `POST` only merges 3 of the ~13 syncable tables
(`vehicleNote`, `maintenanceLog`, `modification`); this is a known pre-existing gap, not something
introduced here.

---

## Per-user theme (server mode)

`ThemeProvider.tsx` applies from this browser's own `localStorage` immediately on mount (avoids a
flash of default theme), then fetches `GET /api/auth/me` — if it's a real signed-in identity (server
mode, not the loopback bypass) and the account has saved theme fields, those override the local
fallback. Each `useCurrentAccent`/`useCurrentRadius`/`useCurrentFont`/`useCurrentScheme` setter both
applies locally and fire-and-forgets a `PUT /api/user/theme` (self-only — a user can only set their
own). This is what makes the same account's look follow it to a different browser/device; local mode
and the loopback bypass never call the server path at all (the PUT just 401s silently, which is fine
since it's never awaited or surfaced).

Known minor gap: the Settings page's own `useCurrentX` hooks read `localStorage` once on mount for
their swatch-highlight state, so on a brand-new browser the highlighted swatch can lag a moment behind
`ThemeProvider`'s async server override (the actual applied CSS variables are always correct). Self-
corrects on any interaction or reload — not worth a shared theme context for this.

---

## Environment variables

| Variable | Required | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Docker only | `file:/data/buildverse.db` — dev uses `.env`/`.env.local` |
| `AUTH_SESSION_SECRET` | Optional (server mode) | Long random string signing session cookies. **Setting this is what turns server-mode auth on at all** — `isAuthEnabled()` in `src/lib/auth/password.ts`. |
| `ADMIN_USERNAME` | Optional | Pre-provisioned bootstrap admin's username, default `admin`. Leave unset to use self-service setup instead (see Authentication). |
| `ADMIN_PASSWORD_HASH` | Optional | Generate with `node scripts/hash-password.js "password"`. Only needed if pre-provisioning the first admin instead of using self-service setup. |

SMTP settings (for temp-password emails) are configured at runtime from **Settings → Access & Sync →
Email (SMTP)**, not env vars — stored in the `Setting` table.

**Docker:** these three come from a `.env` file placed next to `docker-compose.yml` (copy
`.env.example`) — `docker compose` loads it automatically for the `${VAR}` references in that file.
Don't edit `docker-compose.yml`'s `environment:` block directly. This is a common point of confusion
(a missing/empty `.env` silently means auth stays off, and the server fails open — no login at all,
not a lockout), so `docker-init-db.js` doesn't warn about it; check `/api/health`'s `mode` field
(`"server"` vs `"local"`) to confirm auth actually activated after deploying.

Local dev: copy `.env.local` — no variables needed for basic use.

---

## Common commands

```powershell
# Start dev server
npm run dev

# Database
npx prisma db push          # apply schema changes
npx prisma studio           # GUI browser
npx prisma db push --force-reset  # wipe + recreate (dev only)

# Electron desktop app
npm run electron:dev        # dev mode (Next.js + Electron together)
npm run package:win         # build installer → dist-electron/

# Seed sample data
npm run setup
```

---

## Release workflow

Every change pushed to `main` should be:
1. Committed with a descriptive message
2. Version bumped in `package.json`
3. Tagged as `v{version}` and pushed

```powershell
# After making changes:
git add <files>
git commit -m "feat/fix/chore: description"

# Bump version in package.json, then:
git add package.json
git commit -m "chore: bump version to X.X.X"
git tag vX.X.X
git push origin main
git push origin vX.X.X
```

GitHub Actions picks up version tags and builds the Electron installer + Docker image automatically.

---

## Key patterns & conventions

- **No hardcoded orange** — use `text-theme` / `bg-theme` / `border-theme` for all accent colors. The user can change the accent color in Settings.
- **Status labels ≠ DB values** — DB stores `"RESEARCHING"`, UI shows `"Researching / Idea"`. Always go through `getStatusConfig()` or `STATUS_LABELS` map for display.
- **URL validation** — all `link` and `imageUrl` fields accept `https://` or `data:image/` (base64 uploads). The Zod `safeUrl` validator in API routes enforces this.
- **Image uploads** — vehicles and mods support base64 `data:image/` strings stored directly in the DB (up to ~7.5 MB). The `ImageUpload` component handles camera/file input + compression.
- **Tabs in `garage/[id]`** — Mods, Kanban, Maintenance, Budget, Dyno, Tune Logs, Files, Notes, Links. Each tab is self-contained; data is fetched at page level and passed down.
- **Product scraper** — `src/lib/scraper.ts` uses `cheerio` + native `fetch`. It has SSRF protection blocking private IPs. Called from `POST /api/products` and `POST /api/products/[id]/refresh`.
- **LubeLogger integration** — config stored in `Setting` table (`lubelogger_url`, `lubelogger_token`). Pull sync via `/api/integrations/lubelogger/sync` deduplicates on `externalId`.
- **Mobile layout** — `BottomNav` shows on small screens, `Sidebar` hidden. Both live in `src/components/layout/`.
- **Category customization** — users can add custom categories in Settings, stored in the `Setting` table. The `use-categories` hook merges defaults + custom.
