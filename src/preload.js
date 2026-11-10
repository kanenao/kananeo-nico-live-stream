"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kananeoApp", Object.freeze({
  name: "kananeo nico live stream",
  version: "0.1.0-beta.3",
  platform: process.platform,
  stage: "niconico-session-and-watch-page-check",
  niconico: Object.freeze({
    openLogin: () => ipcRenderer.invoke("niconico:open-login"),
    getSessionStatus: () => ipcRenderer.invoke("niconico:get-session-status"),
    logout: () => ipcRenderer.invoke("niconico:logout"),
    checkProgram: input => ipcRenderer.invoke("niconico:check-program", input),
    onSessionChanged: callback => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("niconico:session-changed", listener);
      return () => ipcRenderer.removeListener("niconico:session-changed", listener);
    }
  })
}));
