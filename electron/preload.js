"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,

  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  backup: {
    create:  ()          => ipcRenderer.invoke("backup:create"),
    list:    ()          => ipcRenderer.invoke("backup:list"),
    restore: (filePath)  => ipcRenderer.invoke("backup:restore", filePath),
    delete:  (filePath)  => ipcRenderer.invoke("backup:delete",  filePath),
  },

  update: {
    check:   () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    /** Subscribe to status events; returns an unsubscribe function. */
    onStatus: (cb) => {
      const handler = (_, data) => cb(data);
      ipcRenderer.on("update:status", handler);
      return () => ipcRenderer.removeListener("update:status", handler);
    },
  },
});
