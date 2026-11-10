"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kananeoApp", Object.freeze({
  name:"kananeo nico live stream",
  version:"0.1.0-beta.4",
  platform:process.platform,
  stage:"ndgr-comment-stream",
  niconico:Object.freeze({
    openLogin:()=>ipcRenderer.invoke("niconico:open-login"),
    getSessionStatus:()=>ipcRenderer.invoke("niconico:get-session-status"),
    logout:()=>ipcRenderer.invoke("niconico:logout"),
    checkProgram:input=>ipcRenderer.invoke("niconico:check-program",input),
    startComments:(input,options)=>ipcRenderer.invoke("niconico:start-comments",input,options),
    stopComments:()=>ipcRenderer.invoke("niconico:stop-comments"),
    copyText:value=>ipcRenderer.invoke("app:copy-text",value),
    onComment:callback=>{
      if(typeof callback!=="function") return ()=>{};
      const listener=(_event,comment)=>callback(comment);
      ipcRenderer.on("niconico:comment",listener);
      return ()=>ipcRenderer.removeListener("niconico:comment",listener);
    },
    onCommentState:callback=>{
      if(typeof callback!=="function") return ()=>{};
      const listener=(_event,state)=>callback(state);
      ipcRenderer.on("niconico:comment-state",listener);
      return ()=>ipcRenderer.removeListener("niconico:comment-state",listener);
    },
    onSessionChanged:callback=>{
      if(typeof callback!=="function") return ()=>{};
      const listener=(_event,status)=>callback(status);
      ipcRenderer.on("niconico:session-changed",listener);
      return ()=>ipcRenderer.removeListener("niconico:session-changed",listener);
    }
  })
}));
