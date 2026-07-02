// BuildVerse Sync Manager — supports Server, WebDAV, Google Drive
const BvSync = {

  // ── Config ─────────────────────────────────────────────────────────────────

  getConfig() {
    return {
      method:         localStorage.getItem("bv_sync_method")          || "server",
      serverUrl:      localStorage.getItem("bv_server_url")           || "",
      webdavUrl:      localStorage.getItem("bv_sync_webdav_url")      || "",
      webdavUsername: localStorage.getItem("bv_sync_webdav_username") || "",
      webdavPassword: localStorage.getItem("bv_sync_webdav_password") || "",
    };
  },

  // ── Public API ─────────────────────────────────────────────────────────────

  async download() {
    const cfg = this.getConfig();
    if (cfg.method === "server") return this._serverDownload(cfg);
    if (cfg.method === "webdav") return this._webdavDownload(cfg);
    throw new Error("No sync method configured");
  },

  async upload(queue) {
    const cfg = this.getConfig();
    if (cfg.method === "server") return this._serverUpload(cfg, queue);
    if (cfg.method === "webdav") return this._webdavUpload(cfg, queue);
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

};

window.BvSync = BvSync;
