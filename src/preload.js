"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kananeoApp", Object.freeze({
  name:"kananeo nico live stream",
  version:"0.1.0-beta.6",
  platform:process.platform,
  stage:"video-request-queue-and-player",
  niconico:Object.freeze({
    openLogin:()=>ipcRenderer.invoke("niconico:open-login"),
    validateVideo:input=>ipcRenderer.invoke("niconico:validate-video",input),
    extractRequestCandidate:input=>ipcRenderer.invoke("niconico:extract-request",input),
    openVideo:input=>ipcRenderer.invoke("niconico:open-video",input),
    focusVideo:()=>ipcRenderer.invoke("niconico:focus-video"),
    closeVideo:()=>ipcRenderer.invoke("niconico:close-video"),
    getSessionStatus:()=>ipcRenderer.invoke("niconico:get-session-status"),
    logout:()=>ipcRenderer.invoke("niconico:logout"),
    checkProgram:input=>ipcRenderer.invoke("niconico:check-program",input),
    startComments:(input,options)=>ipcRenderer.invoke("niconico:start-comments",input,options),
    stopComments:()=>ipcRenderer.invoke("niconico:stop-comments"),
    openCommentFolder:()=>ipcRenderer.invoke("app:open-comment-recordings"),
    copyText:value=>ipcRenderer.invoke("app:copy-text",value),
    onVideoState:callback=>{
      if(typeof callback!=="function") return ()=>{};
      const listener=(_event,state)=>callback(state);
      ipcRenderer.on("niconico:player-state",listener);
      return ()=>ipcRenderer.removeListener("niconico:player-state",listener);
    },
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
