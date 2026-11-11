"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  normalizeUserProfiles,
  normalizeUserProfile,
  upsertUserProfile,
  removeUserProfile,
  findUserProfile
}=require("../src/user-profiles");

test("normalizes local user profiles and removes duplicate IDs",()=>{
  const profiles=normalizeUserProfiles([
    {userId:" 123 ",nickname:"常連",memo:"よく来る"},
    {userId:"123",nickname:"重複"},
    {userId:"",nickname:"invalid"},
    {userId:"456",nickname:"別ユーザー"}
  ]);
  assert.equal(profiles.length,2);
  assert.equal(profiles[0].userId,"123");
  assert.equal(profiles[0].nickname,"常連");
});

test("rejects empty profiles and limits field lengths",()=>{
  assert.equal(normalizeUserProfile({userId:"123"}),null);
  const profile=normalizeUserProfile({userId:"123",nickname:"n".repeat(100),memo:"m".repeat(1200)});
  assert.equal(profile.nickname.length,80);
  assert.equal(profile.memo.length,1000);
});

test("creates and updates a nickname while preserving the original creation date",()=>{
  const created=upsertUserProfile([],{userId:"123",nickname:"初回"},{now:"2026-11-12T00:00:00.000Z"});
  assert.equal(created.ok,true);
  const updated=upsertUserProfile(created.profiles,{userId:"123",nickname:"常連",memo:"メモ"},{now:"2026-11-13T00:00:00.000Z"});
  assert.equal(updated.ok,true);
  assert.equal(updated.profiles.length,1);
  assert.equal(updated.profile.nickname,"常連");
  assert.equal(updated.profile.createdAt,"2026-11-12T00:00:00.000Z");
  assert.equal(updated.profile.updatedAt,"2026-11-13T00:00:00.000Z");
});

test("finds and removes profiles by user ID",()=>{
  const source=upsertUserProfile([],{userId:"u-1",nickname:"Viewer"}).profiles;
  assert.equal(findUserProfile(source,"u-1").nickname,"Viewer");
  const removed=removeUserProfile(source,"u-1");
  assert.equal(removed.removed,true);
  assert.equal(removed.profiles.length,0);
  assert.equal(findUserProfile(removed.profiles,"u-1"),null);
});
