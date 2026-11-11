"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kananeoApp", Object.freeze({
  name:"kananeo nico live stream",
  version:"0.1.0-beta.13",
  platform:process.platform,
  stage:"quote-auto-next-scheduler",
  niconico:Object.freeze({
    openLogin:()=>ipcRenderer.invoke("niconico:open-login"),
    validateVideo:input=>ipcRenderer.invoke("niconico:validate-video",input),
    startEnquete:input=>ipcRenderer.invoke("niconico:start-enquete",input),
    showEnqueteResult:input=>ipcRenderer.invoke("niconico:show-enquete-result",input),
    finishEnquete:input=>ipcRenderer.invoke("niconico:finish-enquete",input),
    decideEnqueteResult:input=>ipcRenderer.invoke("niconico:decide-enquete",input),
    extractRequestCandidate:input=>ipcRenderer.invoke("niconico:extract-request",input),
    findNextQueueItem:(items,currentId)=>ipcRenderer.invoke("niconico:find-next-queue-item",items,currentId),
    selectPlaybackCandidate:input=>ipcRenderer.invoke("niconico:select-playback-candidate",input),
    getCurrentQuotation:input=>ipcRenderer.invoke("niconico:get-current-quotation",input),
    playQuotedVideo:input=>ipcRenderer.invoke("niconico:play-quoted-video",input),
    stopQuotedVideo:input=>ipcRenderer.invoke("niconico:stop-quoted-video",input),
    openVideo:input=>ipcRenderer.invoke("niconico:open-video",input),
    focusVideo:()=>ipcRenderer.invoke("niconico:focus-video"),
    closeVideo:()=>ipcRenderer.invoke("niconico:close-video"),
    getExtensionOptions:input=>ipcRenderer.invoke("niconico:get-extension-options",input),
    getProgramStatistics:input=>ipcRenderer.invoke("niconico:get-program-statistics",input),
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
