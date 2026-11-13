# Upshift Garage — Claude Code Handoff

> **Naming:** the product was renamed from "BuildVerse" to "Upshift Garage". User-visible text uses the new name (`src/lib/app-info.ts`), but these identifiers deliberately keep the old one so existing installs keep working: the desktop data folder `…/BuildVerse` (pinned via `app.setPath` in `electron/main.js`), `buildverse.db` / `buildverse-*.db` file names, `BUILDVERSE_DATA_DIR`, the electron `appId`, the repo name, and the Docker image path.

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
| `TrackedProduct` | url (unique), title, currentPrice, lowestPrice, highestPrice, previousPrice, alertThreshold, notifyEmail, lastNotifiedPrice, lastError, vendor, priceHistory[] | See "Product tracker" below |
| `Budget` | vehicleId, category (unique pair), planned, actual | upsert by vehicleId+category |
| `MaintenanceLog` | service, date, mileage, cost, shop, diy, nextDue, nextMiles, externalId | externalId used for LubeLogger dedup |
| `DynoRun` | hp, torque, label, date | |
| `VehicleFile` | filename, originalName, mimeType, size | Binary stored on filesystem via API |
| `TuneLog` | name, filename, originalName, size | |
| `VehicleNote` | title, content, color, importance | Sticky-note board |
| `VehicleLink` | title, url, description, category | External links per vehicle |
| `Setting` | key, value | App-wide key/value store (custom categories, LubeLogger config, SMTP config under key `"smtp"`) |
| `User` | username (unique), email, passwordHash, role (admin\|member), mustChangePassword, accentColor, radius, font, colorScheme, prefs (JSON) | Server mode only — see Authentication below. Everyone shares the same garage; this is per-person login identity, not data isolation. Theme fields are this account's own saved appearance (see "Per-user theme"). |
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

- There is **no loopback/LAN bypass** in server mode. An earlier version trusted `X-Forwarded-For` /
  an empty `request.ip` to detect "local" callers, which any remote client could forge — a full auth
  bypass. Electron's local mode never sets `AUTH_SESSION_SECRET` (auth is simply off there), and its
  "Connect to Server" mode signs in like any other client.
- Every request needs a valid session cookie (`bv_session`, signed via `AUTH_SESSION_SECRET` — see
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

**Privileged checks hit the database.** Session JWTs (7-day lifetime) are stateless and can carry a stale
role, so admin-only routes use `requireAdmin()` and vehicle edits use `canEditVehicle()` — both in
`src/lib/auth/` — which re-read the live `User` row. Don't gate anything privileged on the
`x-user-role` header alone. Admin-only for shared/global actions: wipe, remove-sample-data, custom
categories, LubeLogger config/sync/test, restore-db, user/SMTP/access management.

**Per-vehicle edit access:** viewing the garage is always shared. Editing a given vehicle (and its
mods/maintenance/budget/etc.) requires being an admin, that vehicle's creator (`Vehicle.createdByUserId`,
set from `x-user-id` at creation time), or holding an explicit `VehicleAccess` grant — see
`src/lib/auth/vehicle-access.ts`'s `canEditVehicle()`, called from every mutating vehicle sub-resource
route. Admins manage grants from **Settings → Access & Sync → Vehicle Access**
(`GET/POST/DELETE /api/admin/vehicle-access`).

---

## Server-as-source-of-truth (replaces the old Google Drive / WebDAV / "Upshift Garage Server" picker)

The desktop Settings → Access & Sync tab used to offer a Google Drive / WebDAV / "Upshift Garage Server"
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

## Product tracker & price alerts

- **All server logic is in `src/lib/price-tracker.ts`**: `refreshProduct()` (never overwrites a good price/title
  on a failed scrape — it only sets `lastError`; all-time low/high are only ever widened; a history row is
  written only when the price moves or once a day), `evaluateAlert()` (pure, unit-testable), `runPriceCheck()`
  (a few products at a time, one digest email per run) and the settings (`Setting` key `price_alerts`).
- **Background checks:** `src/instrumentation.ts` → `src/lib/price-scheduler.ts` ticks every 15 min and checks
  whatever is older than the configured interval. Requires `experimental.instrumentationHook` in `next.config.mjs`.
  Runs in Docker and in Electron's spawned server; nothing runs during `next build`.
- **Email is opt-in twice:** global switch (Settings → Price Alerts) AND per-product `notifyEmail`. Fires once when
  a price first reaches the target, again only if it drops lower; re-arms after the price rises above the target.
  Never alerts off a failed check. Scraped titles are HTML-escaped in the email (untrusted input).
- **SMTP** is shared with the account-email feature (`src/lib/mailer.ts`) and can be set up from Settings → Price
  Alerts (works in local/Electron mode too, via `requireAdmin(req, true)`).
- **Scraper** prefers schema.org JSON-LD (`extractJsonLd`) over CSS-class guessing, and returns `failed: true` when
  the page couldn't be fetched — callers must check it.

### Bought products & syncing by car

- `DONE_STATUSES` / `isDoneStatus()` (`src/lib/product-links.ts`) = PURCHASED / INSTALLED / REMOVED. Such mods are skipped by `POST /api/products/sync` (which takes `{vehicleIds?}`; `GET` feeds the car picker), rejected by `POST /api/vehicles/[id]/tracked`, and hidden from the garage page's "Track this price".
- `pruneBoughtProducts()` (price-tracker.ts) deletes a tracked product when every mod linked to its normalized URL is done (any still-active mod, e.g. on another car, keeps it; hand-added products with no linked mod are never touched). Runs at the start of `runPriceCheck`, in refresh-all and after sync, gated by the `autoRemoveBought` setting (default on). Removals are logged in `Setting` key `price_removed` → `GET/DELETE /api/products/removed` → banner on the tracker page.
- `DELETE /api/products` `{confirm:true}` (admin) clears everything.

### Restock alerts, mod links, shop comparison

- **Restock:** `TrackedProduct.notifyRestock` (per product, needs the global email switch). Compared against
  `stockSeen`/`evalPrice`, which only the BACKGROUND check updates — otherwise the silent page-load refresh would
  swallow a restock or price drop before the scheduler saw it. A restock that is also at the target price is one email.
- **Mod ↔ product links:** matched by `normalizeProductUrl()` (`src/lib/product-links.ts` — strips `www.`, `#frag`,
  `utm_*`, trailing slash), never by raw string equality. `GET /api/vehicles/[id]/tracked` (one call per vehicle),
  `POST` to start tracking a mod's link, `GET /api/products/links` for the tracker side.
- **Shop comparison:** products sharing a `compareGroup` name (case/space-insensitive) are ranked cheapest-first among
  in-stock items (`rankGroup`/`groupInfoFor` in `src/components/products/types.ts`); out-of-stock is never "best".

## Backups

`src/lib/backup.ts` — snapshots via SQLite `VACUUM INTO` (consistent under WAL, unlike a file copy), written to
`<BUILDVERSE_DATA_DIR>/backups/buildverse-<timestamp>.db` (same folder/naming the desktop app's own list reads).
`src/lib/backup-scheduler.ts` (started from `src/instrumentation.ts`) checks every 30 min and backs up when the newest
is older than the interval; settings (`Setting` key `auto_backups`: enabled / intervalHours / keep) default to
daily, keep 7. Admin-only API under `/api/admin/backups` (a backup contains password hashes and secrets). Restore
(server mode only) needs the admin's password, takes a `before-restore` safety backup, swaps the file, clears stale
`-wal`/`-shm`, and exits so the container restarts onto it. Backup names come from URLs: always go through
`backupPath()` (strict allow-list), never `path.join` with the raw name.

## Materials (frosted-glass themes)

`Prefs.material` (`src/lib/prefs.ts`): `classic` (the original solid look, default) · `light-frosted` · `dark-frosted` ·
`clear-crystal`. Set via the floating pill (`src/components/settings/MaterialSwitcher.tsx`, Settings → General) and
synced per account like the other display prefs. A non-classic material sets `data-material` on `<html>`; **all glass CSS
lives at the bottom of `src/app/globals.css` and is scoped to `html[data-material]`, so Classic is untouched.**

- Three levels, like Apple's thin/regular/thick materials, driven by per-theme tokens (`--g-thin-bg`, `--g-reg-filter`,
  `--g-heavy-bg`, `--g-border-hi`, `--g-mesh`…): *thin* = `bg-secondary`/`bg-muted`/inputs/pills, *regular* = `bg-card`,
  *heavy* = sidebar/bottom nav, `[role=dialog|menu|listbox]`, `bg-popover`, toasts. Don't hand-style glass in components —
  use the existing `bg-card` / `bg-secondary` classes and the CSS maps them. The `.btn` class on `Button` makes it a pill.
- A material dictates light vs dark (`syncSchemeClass()`); the user's own Color mode is restored when they return to Classic.
  `usePrefs()` is in `src/hooks/use-prefs.ts` — keep React out of `prefs.ts` (server code imports it via `utils.ts`).
- Contrast: the tokens were tuned against measured WCAG ratios (all key text ≥ 4.5:1 in the three glass modes). If you change
  a mesh colour or alpha, re-check — Clear Crystal in particular needs its violet tint to keep white text readable.
- **Tuning + custom background** (`GlassControls.tsx`): sliders for opacity / blur / saturation / edge shine / shadow /
  corner radius, plus the user's own picture with tint and blur. Every glass colour is a *channel + alpha* token
  (`--g-reg-rgb` + `--g-reg-a`) and the derived `--g-*-bg` / `--g-*-filter` multiply by `--g-k-*` factors that
  `applyGlassVars()` sets inline — so never hard-code an `rgba()` for glass; add/scale a token. Limits live in
  `GLASS_LIMITS` and are enforced by `sanitizePrefs` (also on the server). Slider changes apply instantly but are saved to the
  account debounced (`queueRemoteSave`).
- The **picture** is stored only in this browser (`localStorage["bv-bg-image"]`, a JPEG data URL), never uploaded.
  `processBackgroundFile()` (`src/lib/background-image.ts`) re-encodes it through a canvas (≤2560px, ≤2.4 MB, EXIF/GPS dropped),
  and `getBackgroundImage()` only returns strings matching a strict `data:image/(jpeg|webp|png);base64,…` pattern. The inline
  script in `layout.tsx` applies it before first paint — keep it backslash-free (it lives in a template literal).
- `body::before` = the fixed gradient mesh, `body::after` = slow drifting orbs (off under reduce-motion).

## Logo & icons

One source of truth: **`public/logo.svg`** (512×512 rounded-square mark — garage outline, H-pattern gate with reverse
top-left, first gear lit). `npm run gen-icons` (`scripts/gen-icons.js`, uses `@resvg/resvg-js` only) regenerates everything
from it: `build/icon.{ico,png}` + `build/icon-mac.png` (committed — the installers read them; `.gitignore` uses `/build/*`
+ negations because git can't re-include files inside an ignored directory), favicons / `apple-touch-icon.png`,
`src/lib/logo-data.ts` (inline PNG for the PDF), `capacitor-app/logo.svg`, and the Android launcher/splash images.
In the web UI use `<Logo />` (`src/components/Logo.tsx`) — same artwork drawn inline so its blue follows the user's accent
colour (`fixed` pins the brand blue). If you change the artwork, edit `public/logo.svg` **and** `Logo.tsx`, then re-run the script.

## Per-user display prefs

`src/lib/prefs.ts` — interface size (root font-size), sidebar width, reduce motion, currency, show cents, date
format. Stored in `localStorage` (`bv-prefs`) and, when signed in, `User.prefs`. `formatCurrency`/`formatDate` read
them, so currency/date changes reload the page. Use `formatPrice()` (always 2 decimals) for individual product prices.
Custom accent colors are stored in the accent field as `custom:#rrggbb`.

## Environment variables

| Variable | Required | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Docker only | `file:/data/buildverse.db` — dev uses `.env`/`.env.local` |
| `AUTH_SESSION_SECRET` | Optional (server mode) | Long random string signing session cookies. **Setting this is what turns server-mode auth on at all** — `isAuthEnabled()` in `src/lib/auth/password.ts`. |
| `APP_URL` | Recommended (server mode) | Public URL of the deployment. Used for links in reset/welcome emails; if unset the request Host header is used, which can be forged (host-header poisoning). |
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

1. Update `RELEASE_NOTES.md` (it becomes the top of the GitHub release page) and add a `CHANGELOG.md` entry.
2. Bump the version: `npm version <patch|minor|major> --no-git-tag-version`; commit with a descriptive message and push to `main`.
3. Wait for the **Type Check** run on `main` to pass, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

The tag triggers **Build & Release** (`release.yml`: Windows → then Linux and macOS arm64/x64 in parallel, all attached to one release)
and **Docker** (`docker-publish.yml`: `ghcr.io/anthonykphoto/buildverse:X.Y.Z` + `:latest`, which Watchtower deploys to the live server).
Where tags can't be pushed (e.g. the Claude sandbox returns 403), run `release.yml` and `docker-publish.yml` via `workflow_dispatch` with `version` (ref `main`) — the release step creates the `vX.Y.Z` tag itself. After the macOS jobs, `update-cask` runs `scripts/update-cask.js` to rewrite `Casks/upshift-garage.rb` (version + per-arch sha256) and commits it to `main`; users install with `brew tap AnthonyKPhoto/buildverse https://github.com/AnthonyKPhoto/buildverse && brew install --cask upshift-garage` (the cask's postflight clears the quarantine flag because the app is only ad-hoc signed).
The release body is composed once in the Windows job; the other jobs only upload files (parallel body-appends overwrite each other).
macOS builds are ad-hoc signed by `scripts/after-pack.js` (no Apple Developer certificate); they don't auto-update.

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
