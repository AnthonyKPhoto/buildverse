# BuildVerse — Intelligent Vehicle Modification Manager

Plan, track, budget, research, and organize your vehicle modifications.
Runs **100% locally by default** — no cloud, no accounts, no internet required.
Optionally, self-host it as a server (Docker) so the desktop app and your phone
share the same live data instead of each keeping a separate copy.

Available as:
- **Windows Desktop App** (Electron) — install from GitHub Releases, system tray, fully self-contained
- **Linux Desktop App** (Electron) — AppImage or .deb, install from GitHub Releases, system tray
- **Browser App** — run via Node.js / `npm run dev`
- **Self-hosted Server** (Docker) — one shared database with real per-user accounts, reachable from the desktop app, a browser, and the Android app

---

## ⬇️ Download (Windows)

**Go to [Releases](../../releases) and download the latest `BuildVerse Setup x.x.x.exe`.**

1. Download the installer
2. Double-click it — Windows may show a SmartScreen warning; click **"More info" → "Run anyway"**
   *(The app is not code-signed yet. It is safe.)*
3. Follow the wizard → Finish
4. Launch from the Desktop or Start Menu shortcut

**No Node.js, no npm, no prerequisites.** Everything is bundled inside the installer.

> **Portable option:** Download `BuildVerse x.x.x Portable.exe` — runs from any folder without installing.

---

## ⬇️ Download (Linux)

**Go to [Releases](../../releases) and download the latest `BuildVerse-x.x.x.AppImage` or `buildverse_x.x.x_amd64.deb`.**

**No Node.js, no prerequisites.** Everything is bundled inside the package.

**AppImage** (works on most distros, no install):
```bash
chmod +x BuildVerse-x.x.x.AppImage
./BuildVerse-x.x.x.AppImage
```

**Debian/Ubuntu (.deb)**:
```bash
sudo apt install ./buildverse_x.x.x_amd64.deb
```

---

## Features

- **Garage** — Add multiple vehicles with full specs (year/make/model/trim/engine/platform)
- **Modification Tracker** — Wishlist → Research → Order → Purchase → Install pipeline
- **Build Planner** — Cross-vehicle mod planning with category grouping and filters
- **Budget Planner** — Planned vs actual spend per category with bar and pie charts
- **Product Tracker** — Paste any vendor URL to monitor prices over time
- **Maintenance Logs** — Full service history with next-due alerts
- **Vendor Directory** — Curated list of trusted automotive vendors
- **Data Export** — JSON backup from the Settings page
- **Per-user appearance** (server mode) — each account's accent color, corner style, font, and light/dark mode is saved to their own account and follows them across devices/browsers

---

## Development Setup

### Prerequisites
- [Node.js 18+](https://nodejs.org/en/download)
- [Git](https://git-scm.com)

```powershell
# Clone the repo
git clone https://github.com/AnthonyKPhoto/buildverse.git
cd buildverse

# Install dependencies
npm install

# Set up database and load demo data (run once)
npm run setup

# Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

### Run in Electron (dev mode)

```powershell
# Starts Next.js dev server + opens the Electron desktop window
npm run electron:dev
```

---

## Self-Hosting with Docker

Running BuildVerse as a server makes it the single source of truth: the desktop
app (in "Connect to Server" mode) and a phone browser both talk to the same
live database, so an edit made on one shows up on the other immediately —
nothing to sync or merge, because there's only one database.

### 1. Point a domain at your server

Set up a reverse proxy (Caddy, nginx, Nginx Proxy Manager, a Cloudflare
Tunnel — whatever you already use) in front of this container's port 3456,
terminating HTTPS. `docker-compose.yml` doesn't bundle a proxy itself, since
most self-hosters already have one.

### 2. Configure

Create a `.env` file **in the same directory as `docker-compose.yml`** (copy
`.env.example` — `docker compose` loads a `.env` file next to it automatically,
no extra flags needed):
```powershell
cp .env.example .env
```

Then set, in that `.env` file:
```
AUTH_SESSION_SECRET=<any long random string>
```

That's the only variable that's actually required — setting it turns on
login for everyone except local connections (auth is completely inert, and
local dev/Electron completely unaffected, if it's left unset). **Without
this set, the server runs with no login at all — anyone with the URL can
view and edit everything.**

Optionally, pre-provision a specific admin account before your first visit:
```powershell
node scripts/hash-password.js "your-password"
```
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<output from hash-password.js>
```
If you skip this, the first person to visit the site gets a "create the
admin account" form instead of a login form — whoever submits it first
becomes admin. Simplest for a fresh deploy; just don't leave that window
open on the public internet longer than it takes you to sign up.

If you're already running and want to turn auth on now: create/edit `.env`
next to `docker-compose.yml` as above, then `docker compose up -d` to
recreate the container with the new values (a plain restart isn't enough —
compose only re-reads `.env` on `up`).

### 3. Start it

```powershell
docker compose up -d
```

The schema is applied automatically on every boot (a no-op once already up
to date, so this is always safe to re-run, not just on first start). Visit
your domain and either sign in with the admin account above, or create the
admin account if you didn't pre-provision one.

### 4. Update later

Watchtower (bundled in `docker-compose.yml`) polls for new images hourly and
updates automatically. To update immediately:
```powershell
docker compose pull
docker compose up -d
```

### Multiple users

Everyone can *view* the same shared garage — separate logins are for
individual accountability and per-vehicle *edit* permissions, not separate
data. Sign in as the admin account, then **Settings → Access & Sync →
Users** to add an account for each person (member or admin role), remove
accounts, or reset someone's password.

Adding a user with just a username/password works immediately. Give an
email instead of typing a password and BuildVerse generates a temporary one
and emails it (configure SMTP first under **Settings → Access & Sync →
Email (SMTP)**) — that account is asked to set its own password on first
sign-in. If email delivery fails, the temp password is shown once so you
can hand it over yourself.

By default a member can edit any vehicle they created; anyone else's
vehicles are view-only for them unless an admin grants edit access under
**Settings → Access & Sync → Vehicle Access**. Admins can always edit
everything.

### Bringing in vehicles from separate local installs

If you and someone else have each been tracking your own vehicles locally
and want them both in the shared server:

1. Each person signs in on their own PC's BuildVerse app (local mode is
   fine) and goes to **Settings → Data & Backup → Export Data** (JSON) or
   **Export Transfer Pack** (.zip) — use the zip if you've uploaded any
   vehicle files or tune logs, since those live on disk and the JSON export
   doesn't include them.
2. Each person signs in to the server (their own account) and uses
   **Settings → Data & Backup → Import Data** (for a JSON file) or
   **Add Vehicles from Transfer Pack** (for a .zip). Both *add* vehicles —
   neither touches anyone else's data, and vehicles imported this way are
   owned by whoever's signed in when they import them.

This is different from **Settings → Access & Sync → Server Data**
(admin-only), which replaces the server's *entire* database from a backup —
use that only once, for your own primary migration onto the server, not for
bringing in a second person's cars. It accepts either a `.db` file (database
only) or a `.zip` transfer pack from Electron's **Export Transfer Pack**
(database *and* any uploaded vehicle files/tune logs, which live on disk and
aren't included in a plain `.db` backup or the JSON export above) — use the
zip if you have any of those, or they won't come across.

---

## Publishing a New Release

GitHub Actions automatically builds and publishes the Windows and Linux installers whenever you push a version tag.

```powershell
# 1. Bump the version in package.json (edit manually or use npm version)
npm version patch     # 1.0.0 → 1.0.1
# or
npm version minor     # 1.0.0 → 1.1.0
# or
npm version major     # 1.0.0 → 2.0.0

# 2. Push the commit AND the generated tag
git push origin main --follow-tags
```

GitHub Actions (`.github/workflows/release.yml`) will:
1. Run the Windows job on `windows-latest`, package the installer, and create the GitHub Release
2. Then run the Linux job on `ubuntu-latest` (after the Windows job, so it appends to the same release instead of racing to create it) and attach the AppImage + .deb

> **First time?** Make sure your repository has **Actions** enabled (Settings → Actions → Allow all actions).
> The workflow uses `GITHUB_TOKEN` which is provided automatically — no extra secrets needed.

### Building locally

```powershell
npm run package:win
# Output: dist-electron/BuildVerse Setup x.x.x.exe
#         dist-electron/BuildVerse x.x.x Portable.exe
```

```bash
# Linux only — must run on Linux (electron-builder can't cross-compile the
# native Prisma query engine from Windows)
npm run package:linux
# Output: dist-electron/BuildVerse-x.x.x.AppImage
#         dist-electron/buildverse_x.x.x_amd64.deb
```

---

## All Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server (browser) |
| `npm run build` | Build Next.js for production |
| `npm start` | Start built Next.js server |
| `npm run setup` | Generate Prisma client + push schema + seed demo data |
| `npm run db:studio` | Open Prisma Studio (visual DB editor) |
| `npm run db:reset` | Wipe database and re-seed demo data |
| `npm run electron` | Launch Electron (requires `npm run dev` to be running) |
| `npm run electron:dev` | Start Next.js dev server + open Electron (one command) |
| `npm run package:win` | Build Windows installer locally |
| `npm run package:linux` | Build Linux AppImage + .deb locally (must run on Linux) |

---

## Data Storage

| Mode | Database location |
|------|------------------|
| Browser / dev | `prisma/dev.db` (project directory) |
| Electron (installed) | `%APPDATA%\BuildVerse\buildverse.db` |
| Electron (portable) | `%APPDATA%\BuildVerse\buildverse.db` |
| Docker | named volume (`/data/buildverse.db` inside the container) |

On first launch the installer's demo database (Example S2000 with a sample build) is copied to the AppData location automatically. Your data persists across app updates.

**Backup:** Settings → Data & Backup → Export Data → downloads a full JSON backup.

---

## Code Signing (optional)

Without a certificate, Windows shows a SmartScreen warning. To remove it:

1. Obtain a code-signing certificate (e.g. from DigiCert, Sectigo, or similar, ~$200–400/yr)
2. Export as `cert.pfx`
3. Uncomment and configure the `certificateFile` lines in `electron-builder.yml`
4. For CI, store the certificate as a base64 GitHub Secret and set `CSC_LINK` / `CSC_KEY_PASSWORD`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop wrapper | Electron 33 |
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | TailwindCSS 3, Radix UI |
| Charts | Recharts |
| Backend | Next.js API Routes |
| Database | SQLite via Prisma ORM |
| Scraping | Cheerio (product price tracking) |
| Self-hosted server | Docker, Watchtower (auto-update) |
| Auth (server mode only) | Signed session cookie (jose), `scrypt` password hash — real per-user accounts, admin-managed, self-service first-admin setup, optional SMTP temp-password emails |
| CI/CD | GitHub Actions |

---

## Supported Vendors (Product Tracker)

ECS Tuning · FCP Euro · 034Motorsport · Integrated Engineering · APR · Unitronic ·
CTS Turbo · UROTuning · BMP Tuning · AutoZone · RockAuto · Amazon · Tire Rack ·
and most sites that use Open Graph or JSON-LD structured data.

---

## Folder Structure

```
buildverse/
├── .github/
│   └── workflows/
│       ├── release.yml   # Builds + publishes installer on git tag push
│       └── ci.yml        # TypeScript check on PRs
├── electron/
│   ├── main.js           # Electron main process (window, tray, server lifecycle)
│   └── preload.js        # Secure context bridge for renderer
├── build/
│   └── ICON_README.txt   # How to add a custom app icon
├── prisma/
│   ├── schema.prisma     # Database models
│   ├── seed.ts           # Demo data (Example S2000 with sample build)
│   └── dev.db            # SQLite (auto-created by npm run setup)
├── src/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── garage/       # Garage + vehicle detail
│   │   ├── builds/       # Cross-vehicle build planner
│   │   ├── budget/       # Budget dashboard with charts
│   │   ├── products/     # Product price tracker
│   │   ├── maintenance/  # Service history
│   │   ├── vendors/      # Vendor directory
│   │   └── settings/     # App settings + data export
│   ├── components/
│   │   ├── ui/           # Radix UI base components
│   │   ├── vehicles/     # AddVehicleDialog
│   │   ├── modifications/ # AddModDialog
│   │   └── maintenance/  # AddMaintenanceDialog
│   └── lib/
│       ├── prisma.ts     # Prisma client singleton
│       ├── scraper.ts    # Product URL scraper (Cheerio)
│       └── utils.ts      # Helpers, constants, formatters
├── electron-builder.yml  # Windows + Linux packaging config
├── next.config.mjs       # Next.js config (standalone output)
└── package.json
```
