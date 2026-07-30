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
      auth/               Login/logout/me — per-user, cookie-based session (see Authentication below)
      admin/              Admin-only: users CRUD, restore-db (raw .db upload, server mode only)
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
    login/                Server-mode login page (username + password)
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
    auth/password.ts       scrypt hash/verify + isAuthEnabled() (Node-only, never import from middleware.ts)
    auth/session.ts        Signed session cookie (jose, Edge-safe) carrying {userId, username, role}
  middleware.ts           Auth gate — loopback always bypasses (Electron's own spawned server); remote requires a valid per-user session
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
| `Setting` | key, value | App-wide key/value store |
| `User` | username (unique), passwordHash, role (admin\|member) | Server mode only — see Authentication below. Everyone shares the same garage; this is per-person login identity, not data isolation. |

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

Auth is entirely **inert** unless `ADMIN_PASSWORD_HASH` is set (i.e. local dev and Electron's local
mode are never affected). When it is set (Docker/server deployments):

- Loopback (`127.0.0.1`, `::1`) always bypasses — this is Electron's own spawned local server talking
  to itself, not a real remote client. It is **not** a subnet/LAN check: a phone on the same Wi-Fi is
  not loopback and still has to sign in as a real user.
- Everyone else needs a valid session cookie (`bv_session`, signed via `AUTH_SESSION_SECRET` — see
  `src/lib/auth/session.ts`), or gets redirected to `/login` (pages) / 401 (API routes).
- `src/middleware.ts` verifies the JWT and, on success, attaches `x-user-id` / `x-user-username` /
  `x-user-role` headers to the request for downstream routes to trust — it strips any client-supplied
  copies of those headers first, so they can't be spoofed.

**First admin:** bootstrapped automatically on container boot from `ADMIN_USERNAME` /
`ADMIN_PASSWORD_HASH` (see `scripts/docker-init-db.js`) — this also re-runs (self-healing) if the
`User` table ever ends up with zero admins, e.g. after restoring an old Electron backup via
`/api/admin/restore-db` that predates the `User` table. Every other account (including more admins)
is created afterward from **Settings → Access & Sync → Users**, admin-only.

**Login:** POST `/api/auth/login` with `{ username, password }`.
**Current user:** GET `/api/auth/me` (reads the headers middleware already attached).

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

**Migrating existing local data onto a server:** Settings → Backups → New Backup (Electron, unchanged)
produces a raw `.db` file; upload it via **Settings → Access & Sync → Server Data** (admin-only,
requires re-entering the admin's own password) to seed the server. This does a full destructive
replace — use it once for your own primary migration, not for adding a second person's cars (for
that, each person exports their own JSON from Settings → Data & Backup → Export Data and imports it
into their own account on the server — that's additive, not destructive).

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

## Environment variables

| Variable | Required | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Docker only | `file:/data/buildverse.db` — dev uses `.env`/`.env.local` |
| `ADMIN_USERNAME` | Optional (server mode) | Bootstrap admin's username, default `admin` |
| `ADMIN_PASSWORD_HASH` | Optional (server mode) | Generate with `node scripts/hash-password.js "password"`. Setting this is what turns auth on at all. |
| `AUTH_SESSION_SECRET` | Required if `ADMIN_PASSWORD_HASH` is set | Long random string signing session cookies |

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
