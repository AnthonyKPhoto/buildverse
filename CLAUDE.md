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
      auth/               Password login/logout (cookie-based)
      oauth/              Google Drive OAuth (PKCE flow)
      gdrive/             Google Drive sync endpoint
      integrations/lubelogger/  LubeLogger pull sync
      stats/              Dashboard aggregate counts
      builds/             Cross-vehicle mod list
      search/             Global search
      suggestions/        Autocomplete suggestions
      sync/               Generic sync trigger
      wipe/               Factory reset
    garage/[id]/          Vehicle detail page (tabs: Mods, Maintenance, Budget, Dyno, Tune Logs, Files, Notes, Links)
    builds/               Cross-vehicle mod list
    budget/               Budget planner with charts
    products/             Product tracker / price monitoring
    maintenance/          Global maintenance log
    vendors/              Static vendor directory
    settings/             App settings, theme, data management
    login/                Remote-access login page
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
    scraper.ts            Product URL scraper (cheerio + fetch, SSRF-guarded)
    lubelogger.ts         LubeLogger API client
    oauth-store.ts        Google Drive token persistence
    pkce-db.ts            PKCE challenge storage
  middleware.ts           Auth gate — local connections always bypass; remote requires session cookie
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

Auth only activates when **both** conditions are true:
1. `BUILDVERSE_REMOTE_ENABLED=1`
2. At least one of `BUILDVERSE_REMOTE_PASSWORD_HASH` or `GOOGLE_AUTH_CLIENT_ID` is set

Local connections (`127.0.0.1`, `::1`) always bypass auth — Electron window never sees a login page.

**Password login:** POST `/api/auth/login` with `{ password }`. Compares SHA-256 hash. Sets `bv_session` cookie (30-day, httpOnly).

**Google login:** PKCE OAuth flow via `/api/auth/google/start` → Google → `/api/auth/google/callback`.

**Google Drive sync:** Separate OAuth (`/api/oauth/google/*`) for Drive backup/restore. Token stored via `oauth-store.ts`.

---

## Environment variables

| Variable | Required | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Docker only | `file:/data/buildverse.db` — dev uses hardcoded path in schema.prisma |
| `BUILDVERSE_REMOTE_ENABLED` | Optional | Set to `1` to require login from non-local IPs |
| `BUILDVERSE_REMOTE_PASSWORD_HASH` | Optional | SHA-256 of the remote access password |
| `GOOGLE_AUTH_CLIENT_ID` | Optional | Google OAuth for login |
| `GOOGLE_AUTH_CLIENT_SECRET` | Optional | Google OAuth for login |
| `GOOGLE_ALLOWED_EMAIL` | Optional | Restrict Google login to one account |
| `BASE_URL` | Docker | Public URL used for OAuth redirect URIs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google Drive backup OAuth (separate from auth) |

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
