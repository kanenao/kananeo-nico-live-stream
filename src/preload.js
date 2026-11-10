const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("kananeoApp", Object.freeze({
  name: "kananeo nico live stream",
  version: "0.1.0-beta.2",
  platform: process.platform,
  stage: "ui-prototype"
}));