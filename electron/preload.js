"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,

  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  prefs: {
    get: ()        => ipcRenderer.invoke("prefs:get"),
    set: (obj)     => ipcRenderer.invoke("prefs:set", obj),
  },

  backup: {
    create:  ()          => ipcRenderer.invoke("backup:create"),
    list:    ()          => ipcRenderer.invoke("backup:list"),
    restore: (filePath)  => ipcRenderer.invoke("backup:restore", filePath),
    delete:  (filePath)  => ipcRenderer.invoke("backup:delete",  filePath),
  },

  update: {
    check:   () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onStatus: (cb) => {
      const handler = (_, data) => cb(data);
      ipcRenderer.on("update:status", handler);
      return () => ipcRenderer.removeListener("update:status", handler);
    },
  },

  network: {
    getLanUrl:     ()          => ipcRenderer.invoke("network:getLanUrl"),
    setLanAccess:  (enabled)   => ipcRenderer.invoke("network:setLanAccess", enabled),
  },

  transfer: {
    exportZip: () => ipcRenderer.invoke("transfer:export-zip"),
    importZip: () => ipcRenderer.invoke("transfer:import-zip"),
  },
});
