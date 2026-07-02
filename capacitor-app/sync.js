// BuildVerse Sync Manager — supports Server, WebDAV, Google Drive
const BvSync = {

  // ── Config ─────────────────────────────────────────────────────────────────

  getConfig() {
    return {
      method:             localStorage.getItem("bv_sync_method")              || "server",
      serverUrl:          localStorage.getItem("bv_server_url")               || "",
      webdavUrl:          localStorage.getItem("bv_sync_webdav_url")          || "",
      webdavUsername:     localStorage.getItem("bv_sync_webdav_username")     || "",
      webdavPassword:     localStorage.getItem("bv_sync_webdav_password")     || "",
      gdriveClientId:     localStorage.getItem("bv_sync_gdrive_client_id")    || "",
      gdriveToken:        localStorage.getItem("bv_sync_gdrive_token")        || "",
      gdriveTokenExpiry:  localStorage.getItem("bv_sync_gdrive_token_expiry") || "0",
    };
  },

  // ── Public API ─────────────────────────────────────────────────────────────

  async download() {
    const cfg = this.getConfig();
    if (cfg.method === "server")  return this._serverDownload(cfg);
    if (cfg.method === "webdav")  return this._webdavDownload(cfg);
    if (cfg.method === "gdrive")  return this._gdriveDownload(cfg);
    throw new Error("No sync method configured");
  },

  // Upload offline queue; for non-server providers this rebuilds the full snapshot
  async upload(queue) {
    const cfg = this.getConfig();
    if (cfg.method === "server")  return this._serverUpload(cfg, queue);
    if (cfg.method === "webdav")  return this._webdavUpload(cfg, queue);
    if (cfg.method === "gdrive")  return this._gdriveUpload(cfg, queue);
    throw new Error("No sync method configured");
  },

  // ── Server ─────────────────────────────────────────────────────────────────

  async _serverDownload(cfg) {
    const base = (cfg.serverUrl || "").replace(/\/$/, "");
    if (!base) throw new Error("Server URL not configured. Tap ⟳ to open sync settings.");
    const res = await this._fetch(base + "/api/sync");
    if (res.status === 401 || res.status === 403) throw new Error("AUTH_REQUIRED");
    if (!res.ok) throw new Error("Server error " + res.status);
    return res.json();
  },

  async _serverUpload(cfg, queue) {
    if (!queue || queue.length === 0) return { merged: 0 };
    const base = (cfg.serverUrl || "").replace(/\/$/, "");
    if (!base) throw new Error("Server URL not configured");
    const res = await this._fetch(base + "/api/sync", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ offlineQueue: queue }),
    });
    if (!res.ok) throw new Error("Upload error " + res.status);
    return res.json();
  },

  // ── WebDAV ─────────────────────────────────────────────────────────────────

  _webdavAuth(cfg) {
    return "Basic " + btoa(`${cfg.webdavUsername}:${cfg.webdavPassword}`);
  },

  _webdavFile(cfg) {
    return cfg.webdavUrl.replace(/\/$/, "") + "/buildverse-sync.json";
  },

  async _webdavDownload(cfg) {
    if (!cfg.webdavUrl) throw new Error("WebDAV URL not configured");
    const res = await this._fetch(this._webdavFile(cfg), {
      headers: { Authorization: this._webdavAuth(cfg) },
    });
    if (res.status === 404) throw new Error("No sync file on WebDAV. Push from desktop first.");
    if (!res.ok) throw new Error("WebDAV read failed: " + res.status);
    return res.json();
  },

  async _webdavUpload(cfg, queue) {
    if (!cfg.webdavUrl) throw new Error("WebDAV URL not configured");
    const snapshot = await this._buildSnapshot(queue);
    const res = await this._fetch(this._webdavFile(cfg), {
      method:  "PUT",
      headers: { Authorization: this._webdavAuth(cfg), "Content-Type": "application/json" },
      body:    JSON.stringify(snapshot),
    });
    if (!res.ok) throw new Error("WebDAV write failed: " + res.status);
    return { merged: queue.length };
  },

  // ── Google Drive ────────────────────────────────────────────────────────────

  _driveTokenValid(cfg) {
    return !!(cfg.gdriveToken && Date.now() < parseInt(cfg.gdriveTokenExpiry) - 60_000);
  },

  async _ensureDriveToken(cfg) {
    if (this._driveTokenValid(cfg)) return cfg.gdriveToken;
    if (!cfg.gdriveClientId) throw new Error("Google Client ID not configured");
    await this._loadGIS();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cfg.gdriveClientId,
        scope:     "https://www.googleapis.com/auth/drive.appdata",
        callback:  (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          const expiry = String(Date.now() + resp.expires_in * 1000);
          localStorage.setItem("bv_sync_gdrive_token",        resp.access_token);
          localStorage.setItem("bv_sync_gdrive_token_expiry", expiry);
          resolve(resp.access_token);
        },
      });
      client.requestAccessToken();
    });
  },

  async _driveFindFile(token) {
    const res = await this._fetch(
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27buildverse-sync.json%27&fields=files(id)",
      { headers: { Authorization: "Bearer " + token } }
    );
    if (!res.ok) throw new Error("Drive list failed: " + res.status);
    const data = await res.json();
    return data.files?.[0] || null;
  },

  async _gdriveDownload(cfg) {
    const token = await this._ensureDriveToken(cfg);
    const file  = await this._driveFindFile(token);
    if (!file) throw new Error("No sync file on Drive. Push from desktop first.");
    const res = await this._fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: "Bearer " + token } }
    );
    if (!res.ok) throw new Error("Drive download failed: " + res.status);
    return res.json();
  },

  async _gdriveUpload(cfg, queue) {
    const token    = await this._ensureDriveToken(cfg);
    const snapshot = await this._buildSnapshot(queue);
    const existing = await this._driveFindFile(token);
    const metadata = {
      name:     "buildverse-sync.json",
      mimeType: "application/json",
      ...(!existing && { parents: ["appDataFolder"] }),
    };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file",     new Blob([JSON.stringify(snapshot)], { type: "application/json" }));

    const url    = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder";
    const method = existing ? "PATCH" : "POST";

    const res = await this._fetch(url, {
      method,
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    if (!res.ok) throw new Error("Drive upload failed: " + res.status);
    return { merged: queue.length };
  },

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async _buildSnapshot(queue = []) {
    const vehicles = await BvDB.getAll("vehicles");
    const result = [];
    for (const v of vehicles) {
      const [mods, logs, notes] = await Promise.all([
        BvDB.getByIndex("modifications",   "vehicleId", v.id),
        BvDB.getByIndex("maintenanceLogs", "vehicleId", v.id),
        BvDB.getByIndex("vehicleNotes",    "vehicleId", v.id),
      ]);
      result.push({ ...v, modifications: mods, maintenanceLogs: logs, vehicleNotes: notes });
    }
    return { version: 2, syncedAt: new Date().toISOString(), vehicles: result, offlineQueue: queue };
  },

  _fetch(url, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    return fetch(url, { ...opts, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  },

  async _loadGIS() {
    if (window.google?.accounts?.oauth2) return;
    return new Promise((resolve, reject) => {
      if (document.getElementById("gis-script")) { resolve(); return; }
      const s = document.createElement("script");
      s.id  = "gis-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.onload  = resolve;
      s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
      document.head.appendChild(s);
    });
  },

  // Authorize Google Drive (call from UI)
  async authorizeGoogle(clientId) {
    if (clientId) localStorage.setItem("bv_sync_gdrive_client_id", clientId);
    const cfg = this.getConfig();
    // Force fresh token
    localStorage.removeItem("bv_sync_gdrive_token");
    localStorage.removeItem("bv_sync_gdrive_token_expiry");
    return this._ensureDriveToken(cfg);
  },
};

window.BvSync = BvSync;
