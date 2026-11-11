"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEnqueteDefinition, decideEnqueteResult } = require("../src/poll-engine");

const choices = ["もう一度", "次の動画へ"];

test("validates a two-choice automatic poll definition", () => {
  const result = normalizeEnqueteDefinition({
    question:"この動画を続けますか？",
    choices,
    waitSeconds:15,
    resultSeconds:10
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.choices, choices);
});

test("rejects invalid, duplicate, or out-of-range poll settings", () => {
  assert.equal(normalizeEnqueteDefinition({question:"",choices,waitSeconds:15,resultSeconds:10}).ok,false);
  assert.equal(normalizeEnqueteDefinition({question:"Q",choices:["A","A"],waitSeconds:15,resultSeconds:10}).code,"DUPLICATE_CHOICES");
  assert.equal(normalizeEnqueteDefinition({question:"Q",choices,waitSeconds:2,resultSeconds:10}).code,"INVALID_WAIT");
  assert.equal(normalizeEnqueteDefinition({question:"Q",choices,waitSeconds:15,resultSeconds:121}).code,"INVALID_RESULT_TIME");
});

test("repeats when the continue choice has the most votes", () => {
  const result = decideEnqueteResult([{name:choices[0],rate:67.5},{name:choices[1],rate:32.5}],choices);
  assert.equal(result.decision,"repeat");
});

test("advances when the next-video choice has the most votes", () => {
  const result = decideEnqueteResult([{name:choices[0],rate:23},{name:choices[1],rate:77}],choices);
  assert.equal(result.decision,"next");
});

test("handles ties and zero votes according to configured rules", () => {
  assert.equal(decideEnqueteResult([{name:choices[0],rate:50},{name:choices[1],rate:50}],choices,{tie:true}).decision,"repeat");
  assert.equal(decideEnqueteResult([{name:choices[0],rate:50},{name:choices[1],rate:50}],choices,{tie:false}).decision,"next");
  assert.equal(decideEnqueteResult([{name:choices[0],rate:0},{name:choices[1],rate:0}],choices,{zero:true}).decision,"repeat");
  assert.equal(decideEnqueteResult([{name:choices[0],rate:0},{name:choices[1],rate:0}],choices,{zero:false}).decision,"next");
});

test("refuses to automate if the result labels do not match", () => {
  assert.equal(decideEnqueteResult([{name:"はい",rate:100},{name:"いいえ",rate:0}],choices).decision,"invalid");
});
