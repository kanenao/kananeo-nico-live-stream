"use strict";

const MAX_BGM_TRACKS = 500;
const MAX_BGM_TRACK_BYTES = 512 * 1024 * 1024;
const MAX_BGM_LIBRARY_BYTES = 10 * 1024 * 1024 * 1024;
const ALLOWED_BGM_EXTENSIONS = Object.freeze([
  ".mp3",".wav",".m4a",".aac",".ogg",".oga",".flac",".opus",".wma"
]);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBgmTrack(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const id = String(input.id ?? "").trim();
  if (!ID_PATTERN.test(id)) return null;
  const extension = String(input.extension ?? "").trim().toLowerCase();
  if (!ALLOWED_BGM_EXTENSIONS.includes(extension)) return null;
  const size = Number(input.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BGM_TRACK_BYTES) return null;
  const name = String(input.name ?? "").replace(/[\\/\\\\\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,160);
  if (!name) return null;
  const addedAt = typeof input.addedAt === "string" && Number.isFinite(Date.parse(input.addedAt))
    ? new Date(input.addedAt).toISOString() : new Date(0).toISOString();
  return {id,name,extension,size,addedAt};
}

function createEmptyBgmLibrary() {
  return {version:1,tracks:[],updatedAt:""};
}

function normalizeBgmLibrary(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const rawTracks = Array.isArray(source.tracks) ? source.tracks : [];
  const tracks = [];
  const seen = new Set();
  let totalBytes = 0;
  for (const raw of rawTracks) {
    const track = normalizeBgmTrack(raw);
    if (!track || seen.has(track.id) || tracks.length >= MAX_BGM_TRACKS) continue;
    if (totalBytes + track.size > MAX_BGM_LIBRARY_BYTES) continue;
    seen.add(track.id);
    tracks.push(track);
    totalBytes += track.size;
  }
  return {
    version:1,
    tracks,
    updatedAt:typeof source.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt))
      ? new Date(source.updatedAt).toISOString() : ""
  };
}

function addBgmTrack(libraryInput, trackInput) {
  const library = normalizeBgmLibrary(libraryInput);
  const track = normalizeBgmTrack(trackInput);
  if (!track) return {ok:false,code:"INVALID_TRACK",library};
  if (library.tracks.some(item=>item.id===track.id)) return {ok:false,code:"DUPLICATE_TRACK",library};
  if (library.tracks.length >= MAX_BGM_TRACKS) return {ok:false,code:"TRACK_LIMIT",library};
  const totalBytes = library.tracks.reduce((sum,item)=>sum+item.size,0);
  if (totalBytes + track.size > MAX_BGM_LIBRARY_BYTES) return {ok:false,code:"LIBRARY_SIZE_LIMIT",library};
  library.tracks.push(track);
  library.updatedAt=new Date().toISOString();
  return {ok:true,library,track};
}

function removeBgmTrack(libraryInput, idInput) {
  const library = normalizeBgmLibrary(libraryInput);
  const id = String(idInput ?? "").trim();
  if (!ID_PATTERN.test(id)) return {ok:false,code:"INVALID_ID",library};
  const index = library.tracks.findIndex(track=>track.id===id);
  if (index < 0) return {ok:false,code:"NOT_FOUND",library};
  const [track] = library.tracks.splice(index,1);
  library.updatedAt=new Date().toISOString();
  return {ok:true,library,track};
}

function moveBgmTrack(libraryInput, idInput, directionInput) {
  const library = normalizeBgmLibrary(libraryInput);
  const id = String(idInput ?? "").trim();
  if (!ID_PATTERN.test(id)) return {ok:false,code:"INVALID_ID",library};
  const direction = String(directionInput ?? "").trim().toLowerCase();
  if (direction !== "up" && direction !== "down") return {ok:false,code:"INVALID_DIRECTION",library};
  const index = library.tracks.findIndex(track=>track.id===id);
  if (index < 0) return {ok:false,code:"NOT_FOUND",library};
  const targetIndex = index + (direction === "up" ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= library.tracks.length) {
    return {ok:false,code:"BOUNDARY",library};
  }
  [library.tracks[index],library.tracks[targetIndex]] = [library.tracks[targetIndex],library.tracks[index]];
  library.updatedAt = new Date().toISOString();
  return {ok:true,library,movedTrackId:id,direction};
}

function normalizeBgmVolume(value, fallback = 0.7) {
  const number=Number(value);
  return Number.isFinite(number) ? Math.max(0,Math.min(1,number)) : fallback;
}

module.exports = Object.freeze({
  MAX_BGM_TRACKS,
  MAX_BGM_TRACK_BYTES,
  MAX_BGM_LIBRARY_BYTES,
  ALLOWED_BGM_EXTENSIONS,
  normalizeBgmTrack,
  createEmptyBgmLibrary,
  normalizeBgmLibrary,
  addBgmTrack,
  removeBgmTrack,
  moveBgmTrack,
  normalizeBgmVolume
});
