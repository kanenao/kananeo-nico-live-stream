"use strict";

const TERMINAL_STATUSES = new Set(["completed","skipped","rejected"]);

function isEligible(item, queueType, remainingMs) {
  if (!item || item.noLivePlay === true || item.no_live_play === 1 || item.playable === false) return false;
  if (TERMINAL_STATUSES.has(String(item.status || "").toLowerCase())) return false;
  if (queueType === "stock" && (item.isPlayed === true || item.is_played === true)) return false;

  const lengthMs = Number(item.lengthMs ?? item.length_ms ?? item.durationMs ?? 0);
  if (Number.isFinite(remainingMs) && remainingMs > 0 && lengthMs > 0 && lengthMs > remainingMs) return false;
  return true;
}

function shuffled(items, random = Math.random) {
  const result = items.slice();
  for (let i=result.length-1;i>0;i--) {
    const value=Number(random());
    const safe=Number.isFinite(value) ? Math.max(0,Math.min(0.999999999,value)) : 0;
    const j=Math.floor(safe*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}

function selectNextPlaybackCandidate(options = {}) {
  const requests=Array.isArray(options.requests) ? options.requests : [];
  const stocks=Array.isArray(options.stocks) ? options.stocks : [];
  const playStyle=Number(options.playStyle) || 0;
  const randomStock=options.randomStock === true;
  const remainingMs=Number(options.remainingMs);
  const random=typeof options.random === "function" ? options.random : Math.random;

  let requestCandidates=requests
    .map((item,index)=>({queue:"request",index,item}))
    .filter(entry=>isEligible(entry.item,"request",remainingMs));
  let stockCandidates=stocks
    .map((item,index)=>({queue:"stock",index,item}))
    .filter(entry=>isEligible(entry.item,"stock",remainingMs));

  if(playStyle===2) requestCandidates=shuffled(requestCandidates,random);
  if(playStyle===2||randomStock) stockCandidates=shuffled(stockCandidates,random);

  return requestCandidates[0] || stockCandidates[0] || null;
}

module.exports = { isEligible, selectNextPlaybackCandidate };
