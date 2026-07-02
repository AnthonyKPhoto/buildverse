// BuildVerse IndexedDB wrapper
const DB_NAME    = "buildverse-offline";
const DB_VERSION = 1;

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("vehicles"))
        db.createObjectStore("vehicles", { keyPath: "id" });

      if (!db.objectStoreNames.contains("modifications")) {
        const s = db.createObjectStore("modifications", { keyPath: "id" });
        s.createIndex("vehicleId", "vehicleId", { unique: false });
      }
      if (!db.objectStoreNames.contains("maintenanceLogs")) {
        const s = db.createObjectStore("maintenanceLogs", { keyPath: "id" });
        s.createIndex("vehicleId", "vehicleId", { unique: false });
      }
      if (!db.objectStoreNames.contains("vehicleNotes")) {
        const s = db.createObjectStore("vehicleNotes", { keyPath: "id" });
        s.createIndex("vehicleId", "vehicleId", { unique: false });
      }
      if (!db.objectStoreNames.contains("offlineQueue"))
        db.createObjectStore("offlineQueue", { keyPath: "id" });
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = ()  => reject(req.error);
  });
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t   = db.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror    = () => reject(t.error);
    if (req) { req.onsuccess = () => {}; req.onerror = () => reject(req.error); }
  }));
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly")
      .objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function put(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readwrite").objectStore(storeName).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function putMany(storeName, items) {
  if (!items || items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, "readwrite");
    const s = t.objectStore(storeName);
    items.forEach(item => s.put(item));
    t.oncomplete = resolve;
    t.onerror    = () => reject(t.error);
  });
}

async function del(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readwrite").objectStore(storeName).clear();
    req.onsuccess = resolve;
    req.onerror   = () => reject(req.error);
  });
}

// Replace all local data with a fresh snapshot from sync
async function importSnapshot(snapshot) {
  const { vehicles = [] } = snapshot;
  await clearStore("vehicles");
  await clearStore("modifications");
  await clearStore("maintenanceLogs");
  await clearStore("vehicleNotes");

  for (const v of vehicles) {
    const { modifications = [], maintenanceLogs = [], vehicleNotes = [], links = [], budgets = [], ...vehicleData } = v;
    await put("vehicles", vehicleData);
    if (modifications.length)   await putMany("modifications",   modifications);
    if (maintenanceLogs.length) await putMany("maintenanceLogs", maintenanceLogs);
    if (vehicleNotes.length)    await putMany("vehicleNotes",    vehicleNotes);
  }
}

async function getQueue()           { return getAll("offlineQueue"); }
async function addToQueue(item)     { return put("offlineQueue", { ...item, id: item.id || _uid() }); }
async function removeFromQueue(ids) { for (const id of ids) await del("offlineQueue", id); }

function _uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }

window.BvDB = {
  openDB, getAll, getByIndex, put, putMany, del, clearStore,
  importSnapshot, getQueue, addToQueue, removeFromQueue,
  uid: _uid,
};
