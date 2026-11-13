## Upshift Garage v1.16.0

### ✨ New
- **Install on macOS with Homebrew** — no more "unidentified developer" block:
  `brew tap AnthonyKPhoto/buildverse https://github.com/AnthonyKPhoto/buildverse && brew install --cask upshift-garage`
- **Sync from Mods, by car** — choose which vehicles' product links to start tracking.
- **Bought means done** — mods that are Purchased, Installed or Removed are never imported into the tracker, can't be tracked, and are **removed automatically** on the next scheduled price check (a part still wanted by another car stays). A banner tells you what was removed; turn it off in *Settings → Price Alerts*.
- **Delete all tracking** — one button (with confirmation) to clear the tracker; mods and their links are untouched.
- **Filter the tracker by car.**

### 🐛 Fixes
- The browser tab icon still showed the old logo for many people because browsers cache favicons aggressively — icons are now versioned and an SVG icon is offered, so the new logo shows up.

### Upgrading
- **Docker:** `docker compose pull && docker compose up -d`. **Windows / Linux** auto-update. **macOS:** `brew upgrade --cask upshift-garage`, or download the new `.dmg`.
- No database changes; your data is untouched.
