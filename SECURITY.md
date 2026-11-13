# Security Policy

## Supported versions

Security fixes land in the **latest release** only. Server (Docker) deployments should stay current — the bundled Watchtower
service updates the image automatically if you keep it enabled.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting instead: open the repository's **Security** tab → **Report a vulnerability**. Include what you
found, the version, how to reproduce it, and the impact you expect. You'll get an acknowledgement, and a fix and release will
follow once the problem is confirmed. Please give a reasonable window to fix before any public disclosure.

*(Maintainer: private vulnerability reporting must be switched on under Settings → Code security for that button to appear.)*

## What's in scope

Upshift Garage runs in two modes, and they have different exposure:

- **Local / desktop** — a single-user app bound to `127.0.0.1`; it is not reachable from other machines.
- **Server mode (Docker)** — meant to be reachable over a network, with real accounts. This is where most security work is focused.

## Deploying server mode safely

1. **Set `AUTH_SESSION_SECRET`** to a long random value. Without it the server has **no login at all**. Confirm with `/api/health` → `"mode":"server"`.
2. **Put HTTPS in front of it** (reverse proxy or tunnel). Session cookies are marked `Secure`. The shipped `docker-compose.yml`
   publishes only on `127.0.0.1`; widen that only if you understand the exposure.
3. **Set `APP_URL`** to your public URL so emailed links can't be redirected by a forged `Host` header.
4. **Create the first admin promptly.** Until an account exists, the first visitor to the site becomes admin.
5. **Treat backups as secrets.** A database backup contains password hashes, the SMTP password and integration keys. Backup
   download/restore is admin-only.
6. **Watchtower** needs the Docker socket, which is root-equivalent on the host. Remove it from `docker-compose.yml` if you'd rather update manually.

## Built-in protections (server mode)

Signed, expiring session cookies (HttpOnly, SameSite=Strict) · scrypt password hashing · rate-limited sign-in, forgot-password and
reset (per address and per account) · admin and per-vehicle permissions re-checked against the database on every sensitive request ·
SSRF-guarded product scraping with per-redirect validation · strict upload, zip and import limits and sanitization · restricted
file-serving types with sandboxing headers · security response headers. Custom background pictures stay in your browser and are never uploaded.
