"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
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
}=require("../src/bgm-library");

const track=(overrides={})=>({
  id:"123e4567-e89b-42d3-a456-426614174000",
  name:"sample",
  extension:".mp3",
  size:1024,
  addedAt:"2026-11-12T10:00:00.000Z",
  ...overrides
});

test("normalizes audio metadata and rejects unsupported extensions",()=>{
  assert.deepEqual(normalizeBgmTrack(track()),track());
  assert.equal(normalizeBgmTrack(track({extension:".exe"})),null);
  assert.equal(normalizeBgmTrack(track({name:"../bad/name"})).name,".. bad name");
  assert.equal(normalizeBgmTrack(track({size:MAX_BGM_TRACK_BYTES+1})),null);
  assert.equal(normalizeBgmTrack(track({id:"bad"})),null);
  assert.equal(ALLOWED_BGM_EXTENSIONS.includes(".oga"),true);
});

test("normalizes a playlist, removes duplicate IDs, and enforces library bounds",()=>{
  const library=normalizeBgmLibrary({tracks:[track(),track(),track({id:"123e4567-e89b-42d3-a456-426614174001",name:"second"})]});
  assert.equal(library.version,1);
  assert.equal(library.tracks.length,2);
  assert.equal(normalizeBgmLibrary(null).tracks.length,0);
  assert.equal(createEmptyBgmLibrary().tracks.length,0);
});

test("adds and removes tracks without changing the input library",()=>{
  const empty=createEmptyBgmLibrary();
  const added=addBgmTrack(empty,track());
  assert.equal(added.ok,true);
  assert.equal(added.library.tracks.length,1);
  assert.equal(empty.tracks.length,0);
  assert.equal(addBgmTrack(added.library,track()).code,"DUPLICATE_TRACK");
  const removed=removeBgmTrack(added.library,track().id);
  assert.equal(removed.ok,true);
  assert.equal(removed.library.tracks.length,0);
  assert.equal(removeBgmTrack(removed.library,track().id).code,"NOT_FOUND");
  assert.equal(removeBgmTrack(added.library,"bad").code,"INVALID_ID");
});

test("enforces the playlist track count limit",()=>{
  const tracks=Array.from({length:MAX_BGM_TRACKS},(_,i)=>track({
    id:"123e4567-e89b-42d3-a456-"+String(i).padStart(12,"0"),
    name:"track "+i
  }));
  const library=normalizeBgmLibrary({tracks});
  assert.equal(library.tracks.length,MAX_BGM_TRACKS);
  assert.equal(addBgmTrack(library,track({id:"123e4567-e89b-42d3-a456-999999999999"})).code,"TRACK_LIMIT");
});

test("clamps BGM volume to the supported range",()=>{
  assert.equal(normalizeBgmVolume(0.35),0.35);
  assert.equal(normalizeBgmVolume(-1),0);
  assert.equal(normalizeBgmVolume(2),1);
  assert.equal(normalizeBgmVolume("bad",0.4),0.4);
});


test("enforces the total local audio library size limit",()=>{
  const tracks=Array.from({length:20},(_,index)=>track({
    id:"123e4567-e89b-42d3-a456-"+String(index).padStart(12,"0"),
    name:"large "+index,
    size:MAX_BGM_TRACK_BYTES
  }));
  const library=normalizeBgmLibrary({tracks});
  assert.equal(library.tracks.length,20);
  assert.equal(library.tracks.reduce((sum,item)=>sum+item.size,0),MAX_BGM_LIBRARY_BYTES);
  const next=track({id:"123e4567-e89b-42d3-a456-999999999999",size:1});
  assert.equal(addBgmTrack(library,next).code,"LIBRARY_SIZE_LIMIT");
});


test("moves BGM tracks up and down while preserving the source library",()=>{
  const first=track();
  const second=track({id:"123e4567-e89b-42d3-a456-426614174001",name:"second"});
  const third=track({id:"123e4567-e89b-42d3-a456-426614174002",name:"third"});
  const original=normalizeBgmLibrary({tracks:[first,second,third]});
  const movedUp=moveBgmTrack(original,third.id,"up");
  assert.equal(movedUp.ok,true);
  assert.deepEqual(movedUp.library.tracks.map(item=>item.id),[first.id,third.id,second.id]);
  const movedDown=moveBgmTrack(movedUp.library,third.id,"down");
  assert.deepEqual(movedDown.library.tracks.map(item=>item.id),[first.id,second.id,third.id]);
  assert.deepEqual(original.tracks.map(item=>item.id),[first.id,second.id,third.id]);
  assert.equal(moveBgmTrack(original,first.id,"up").code,"BOUNDARY");
  assert.equal(moveBgmTrack(original,third.id,"down").code,"BOUNDARY");
  assert.equal(moveBgmTrack(original,"bad","up").code,"INVALID_ID");
  assert.equal(moveBgmTrack(original,first.id,"sideways").code,"INVALID_DIRECTION");
  assert.equal(moveBgmTrack(original,"123e4567-e89b-42d3-a456-426614174099","up").code,"NOT_FOUND");
});
