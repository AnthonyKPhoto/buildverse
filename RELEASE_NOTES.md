## Upshift Garage v1.15.0 — formerly BuildVerse

**BuildVerse is now Upshift Garage**, with a new logo and a big round of features. Everything you've built is safe — see *Upgrading* below.

### ✨ New
- **Rebuilt Product Tracker** — a cleaner layout with sparklines and filters, **background price checks** (even when the app isn't open), and optional **email alerts** (target price, big drops, *back in stock*) delivered as one tidy digest. Prices are read from each shop's structured product data for far fewer wrong or missing numbers.
- **Shop comparison** — track the same part at several shops and see who's cheapest *in stock*, with a **Best price** badge.
- **Mods ⇄ tracker links** — a mod's product link is matched to its tracked price: track it in one click and see "$150 cheaper now — use $1,049".
- **Scheduled backups** — automatic, consistent database snapshots (daily by default, keep the newest 7), with download, delete and — on a server — password-protected restore.
- **Frosted-glass appearance** — three new materials (**Light Frosted**, **Dark Frosted**, **Clear Crystal**) with a floating switcher, plus your own **custom background picture** and sliders for glass opacity, blur, saturation, edge shine, shadow and corner roundness. The original look is still there as **Classic**.
- More customization — custom accent colour, interface size, sidebar width, reduce motion, currency, show-cents and date format (saved per account).
- **macOS app** — Apple Silicon and Intel downloads.
- New logo across the app, installers and the Android app.

### 🔒 Security — please update server deployments
This release fixes several security issues in **server mode (Docker)**, including a sign-in bypass when the server was reachable directly rather than only through a reverse proxy. **If you self-host, update, and set `APP_URL`** (see below). Highlights:
- Stricter authorization for admin-only actions; roles are re-checked against the database instead of trusted from a 30-day token (sessions now last 7 days).
- Hardened password-reset links, file serving, uploads and imports, product scraping (redirect/SSRF handling), and the desktop app's external-link handling.
- Next.js updated to 14.2.35; non-breaking dependency fixes applied.

### 🐛 Fixes
- "Refresh all" no longer overwrites each product's all-time lowest price, and a failed price check no longer replaces a good price/title with a placeholder.
- "Out of stock" no longer looks like "in stock"; product prices show cents.

### Upgrading
- **Your data is safe.** The desktop app keeps its original `BuildVerse` data folder, and the database upgrades itself in place. Docker takes a pre-update copy of the database (`buildverse.db.pre-update.bak`) before changing the schema.
- **Windows / Linux** auto-update. **macOS** doesn't auto-update — download the new `.dmg`.
- **Docker:** `docker compose pull && docker compose up -d`. Add `APP_URL=https://your.domain` to your `.env` so emailed links can't be spoofed. *New installs* using the shipped `docker-compose.yml` now bind to `127.0.0.1:3456` — put a TLS reverse proxy in front, or change the port mapping to `3456:3000` to expose it on your LAN.
- The Docker image path, repo and `buildverse.db` file names are unchanged, so existing setups keep working.
