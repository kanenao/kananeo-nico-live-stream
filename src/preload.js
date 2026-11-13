"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kananeoApp", Object.freeze({
  name:"kananeo nico live stream",
  version:"0.1.0-beta.37",
  platform:process.platform,
  stage:"https-lan-remote-control",
  remote:Object.freeze({
    getStatus:()=>ipcRenderer.invoke("remote:get-status"),
    getLanOptions:()=>ipcRenderer.invoke("remote:get-lan-options"),
    selectTlsFile:kind=>ipcRenderer.invoke("remote:select-tls-file",kind),
    start:options=>ipcRenderer.invoke("remote:start",options),
    stop:()=>ipcRenderer.invoke("remote:stop"),
    createPairing:input=>ipcRenderer.invoke("remote:create-pairing",input),
    revokeDevice:id=>ipcRenderer.invoke("remote:revoke-device",id),
    openController:()=>ipcRenderer.invoke("remote:open-controller"),
    getAudit:()=>ipcRenderer.invoke("remote:audit-list"),
    getNotificationSettings:()=>ipcRenderer.invoke("remote:notification-settings-get"),
    setNotificationSettings:settings=>ipcRenderer.invoke("remote:notification-settings-set",settings),
    clearAudit:()=>ipcRenderer.invoke("remote:audit-clear"),
    exportAudit:filters=>ipcRenderer.invoke("remote:audit-export",filters),
    onRequest:callback=>{
      if(typeof callback!=="function")return ()=>{};
      const listener=(_event,request)=>callback(request);
      ipcRenderer.on("remote-control:request",listener);
      return ()=>ipcRenderer.removeListener("remote-control:request",listener);
    },
    resolveRequest:(requestId,result)=>{
      if(typeof requestId!=="string"||requestId.length>64)return;
      ipcRenderer.send("remote-control:response",{requestId,result});
    }
  }),
  updates:Object.freeze({
    check:()=>ipcRenderer.invoke("app:check-updates"),
    openReleases:()=>ipcRenderer.invoke("app:open-releases")
  }),
  bgm:Object.freeze({
    get:()=>ipcRenderer.invoke("app:bgm-get"),
    addFiles:()=>ipcRenderer.invoke("app:bgm-add-files"),
    remove:id=>ipcRenderer.invoke("app:bgm-remove",id),
    move:(id,direction)=>ipcRenderer.invoke("app:bgm-move",id,direction)
  }),
  videoLibrary:Object.freeze({
    get:()=>ipcRenderer.invoke("app:video-library-get"),
    add:input=>ipcRenderer.invoke("app:video-library-add",input),
    remove:input=>ipcRenderer.invoke("app:video-library-remove",input),
    update:input=>ipcRenderer.invoke("app:video-library-update",input),
    list:input=>ipcRenderer.invoke("app:video-library-list",input),
    importSelected:input=>ipcRenderer.invoke("app:video-library-import-selected",input),
    import:input=>ipcRenderer.invoke("app:video-library-import",input),
    recordPlayback:input=>ipcRenderer.invoke("app:video-library-record-playback",input),
    clearHistory:()=>ipcRenderer.invoke("app:video-library-clear-history")
  }),
  niconico:Object.freeze({
    openLogin:()=>ipcRenderer.invoke("niconico:open-login"),
    openBroadcastCreate:()=>ipcRenderer.invoke("niconico:open-broadcast-create"),
    openBroadcastManage:programId=>ipcRenderer.invoke("niconico:open-broadcast-manage",programId),
    openLiveVideo:programId=>ipcRenderer.invoke("niconico:live-view-open",programId),
    setLiveVideoBounds:bounds=>ipcRenderer.send("niconico:live-view-bounds",bounds),
    closeLiveVideo:()=>ipcRenderer.invoke("niconico:live-view-close"),
    validateVideo:input=>ipcRenderer.invoke("niconico:validate-video",input),
    startEnquete:input=>ipcRenderer.invoke("niconico:start-enquete",input),
    showEnqueteResult:input=>ipcRenderer.invoke("niconico:show-enquete-result",input),
    finishEnquete:input=>ipcRenderer.invoke("niconico:finish-enquete",input),
    decideEnqueteResult:input=>ipcRenderer.invoke("niconico:decide-enquete",input),
    extractRequestCandidate:input=>ipcRenderer.invoke("niconico:extract-request",input),
    evaluateCommentRequest:input=>ipcRenderer.invoke("niconico:evaluate-comment-request",input),
    postBroadcasterComment:input=>ipcRenderer.invoke("niconico:post-broadcaster-comment",input),
    findNextQueueItem:(items,currentId)=>ipcRenderer.invoke("niconico:find-next-queue-item",items,currentId),
    selectPlaybackCandidate:input=>ipcRenderer.invoke("niconico:select-playback-candidate",input),
    getCurrentQuotation:input=>ipcRenderer.invoke("niconico:get-current-quotation",input),
    playQuotedVideo:input=>ipcRenderer.invoke("niconico:play-quoted-video",input),
    stopQuotedVideo:input=>ipcRenderer.invoke("niconico:stop-quoted-video",input),
    openVideo:input=>ipcRenderer.invoke("niconico:open-video",input),
    pauseVideo:()=>ipcRenderer.invoke("niconico:pause-video"),
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
    onLiveVideoState:callback=>{
      if(typeof callback!=="function") return ()=>{};
      const listener=(_event,state)=>callback(state);
      ipcRenderer.on("niconico:live-video-state",listener);
      return ()=>ipcRenderer.removeListener("niconico:live-video-state",listener);
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
