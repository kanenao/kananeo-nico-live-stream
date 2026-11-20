"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const renderer=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
function extract(from,to){
 const first=renderer.indexOf(from),last=renderer.indexOf(to,first+from.length);
 assert.ok(first>=0&&last>first,"renderer function boundaries should exist");
 return renderer.slice(first,last).trim();
}
const nextQuoteSource=extract("async function playNextQuoteItem(options={}){","async function playQueueItem(");
const quoteSource=extract("async function playQuotedQueueItem(","async function stopQuotedPlayback(");
const safePollSource=extract("function safePollVideoMatches(){","function restoreQuoteAutoAfterVerifiedPoll(){");

test("normal automatic next does not require live-start autoplay enabled",async()=>{
 const calls=[];
 const state={lastProgramEndAt:0,
  playback:{stockAutoPlay:false,playStyle:1,randomStock:false,autoPlayOnOwnLive:false},
  requests:[{id:"request-1",videoId:"sm123456",status:"queued",lengthMs:60000}],stocks:[]};
 const ctx={state,Date,toast:()=>{},window:{kananeoApp:{niconico:{
  selectPlaybackCandidate:async()=>({queue:"request",index:0})
 }}},playQuotedQueueItem:async(item,queue,skip,options)=>{
  calls.push({item,queue,skip,options});return true;
 }};
 const playNext=vm.runInNewContext("("+nextQuoteSource+")",ctx);
 assert.equal(await playNext({triggeredByAuto:true,skipConfirmation:true,programId:"lv123"}),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.programId,"lv123");
 assert.equal(calls[0].options.autoLive,false);
 assert.equal(calls[0].skip,true);
 assert.equal(await playNext({triggeredByAuto:true,skipConfirmation:true,programId:"lv456",
  autoLive:true,selectedCandidate:{queue:"request",index:0}}),true);
 assert.equal(calls[1].options.autoLive,true);
 assert.equal(calls[1].options.programId,"lv456");
});
test("real quote mutation is not blocked by the unrelated live-start opt-in",async()=>{
 let quotePosts=0;
 const state={lastProgramId:"lv123",playback:{autoPlayOnOwnLive:false,lastAutoPlayProgramId:"",
  mainVolume:1,subVolume:0}};
 const ctx={state,quotePlayback:{active:false,programId:""},
  commentConnection:{programId:""},toast:()=>{},confirm:()=>true,
  window:{kananeoApp:{niconico:{
   validateVideo:async()=>({ok:true,videoId:"sm1"}),
   getCurrentQuotation:async()=>({ok:true,exists:false}),
   playQuotedVideo:async()=>{quotePosts++;return {ok:false,message:"simulated failure"};}
  }}}
 };
 const play=vm.runInNewContext("("+quoteSource+")",ctx);
 const item={id:"r1",title:"test",videoId:"sm1",status:"queued"};
 assert.equal(await play(item,"request",true,{programId:"lv123",autoLive:false}),false);
 assert.equal(quotePosts,1,"ordinary auto-next should reach the quote API");
 assert.equal(await play(item,"request",true,{programId:"lv123",autoLive:true}),false);
 assert.equal(quotePosts,1,"unapproved live-start auto play must be blocked");
});
test("polls are bound to the exact broadcast and video",()=>{
 const ctx={quotePlayback:{active:true,programId:"lv123",videoId:"sm456"},
  pollCurrentProgramId:"lv123",pollVideoId:"sm456"};
 const matches=vm.runInNewContext("("+safePollSource+")",ctx);
 assert.equal(matches(),true);
 ctx.quotePlayback.programId="lv999";
 assert.equal(matches(),false,"same video, another broadcast must be rejected");
 ctx.quotePlayback.programId="lv123";
 ctx.quotePlayback.videoId="sm999";
 assert.equal(matches(),false,"different video must be rejected");
 ctx.quotePlayback.videoId="sm456";
 ctx.pollCurrentProgramId="";
 assert.equal(matches(),false,"cleared poll ownership is unsafe");
 ctx.pollCurrentProgramId="lv123";
 ctx.quotePlayback.active=false;
 assert.equal(matches(),false,"stopped quote must be rejected");
});
test("quote timer preserves confirmed broadcast; poll restores before removing ownership",()=>{
 assert.match(renderer,/const advanced=await playNextQuoteItem\(\{skipConfirmation:true,triggeredByAuto:true,programId\}\)/);
 assert.match(renderer,/if\(token!==quoteAutoToken\|\|!state\.playback\.quoteAutoNext\|\|quotePlayback\.programId!==programId\)return;/);
 assert.match(renderer,/triggeredByAuto:true,skipConfirmation:true,programId:id,autoLive:true/);
 assert.match(renderer,/autoLive:options\.autoLive===true/);
 const restore=renderer.lastIndexOf("if(resumeNaturalAfterPoll&&safePollVideoMatches())restoreQuoteAutoAfterVerifiedPoll()");
 const clear=renderer.indexOf('pollCurrentProgramId="";pollVideoId="";pollVerifiedRound=false;',restore);
 assert.ok(restore>=0&&clear>restore);
});
