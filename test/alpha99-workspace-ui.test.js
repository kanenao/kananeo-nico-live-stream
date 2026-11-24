"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const renderer=read("src/renderer.js");
const css=read("src/style.css");
const index=read("src/index.html");
const preload=read("src/preload.js");
const pkg=JSON.parse(read("package.json"));

const pages=["dashboard","broadcast","programs","monitor","comments","requests","stocks","library",
 "poll","player","automation","external","remote","audit","voice","users","logs","changelog","settings"];

test("all nineteen menu pages are still present and selectable",()=>{
 const markup=[...index.matchAll(/data-page="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual(markup,pages);
 for(const page of pages)assert.ok(renderer.includes(page+":"),page);
 assert.match(renderer,/b\.setAttribute\("aria-current","page"\)/);
 assert.match(renderer,/b\.removeAttribute\("aria-current"\)/);
});

test("all content pages except native broadcast use the shared workspace",()=>{
 assert.match(renderer,/classList\.toggle\("broadcast-screen-content",page==="broadcast"\)/);
 assert.match(renderer,/classList\.toggle\("workspace-page-content",page!=="broadcast"\)/);
 assert.match(renderer,/contentNode\.dataset\.workspacePage=page/);
 assert.match(css,/\.workspace-page-content\{/);
 assert.match(css,/\.content\.broadcast-screen-content/);
});

test("common page headings and MODULE cards use a single implementation",()=>{
 assert.match(renderer,/function hero\(k,t,d,b=""\)/);
 assert.match(renderer,/class="hero workspace-hero"/);
 assert.match(renderer,/class="panel workspace-card"/);
 assert.match(renderer,/class="workspace-card-heading"/);
 assert.match(renderer,/class="workspace-card-body"/);
 assert.match(renderer,/MODULE \//);
 assert.match(renderer,/String\(\+\+workspaceCardSequence\)\.padStart\(2,"0"\)/);
 assert.match(renderer,/workspaceCardSequence=0/);
});

test("common form fields remain associated with their text labels",()=>{
 assert.match(renderer,/<label for="\$\{id\}">\$\{label\}<\/label>/);
 assert.match(renderer,/id="\$\{id\}"/);
});

test("shared styles cover navigation, controls, status cards and data tables",()=>{
 for(const token of [
  ".sidebar nav",".side-status",".workspace-hero",".workspace-card",
  ".workspace-card-heading",".workspace-card-body",".workspace-card-mark",
  ".workspace-page-content .stats",".workspace-page-content .btn",
  ".workspace-page-content .btn.primary",".workspace-page-content .btn.danger",
  ".workspace-page-content .field",".workspace-page-content .input",
  ".workspace-page-content .switchrow",".workspace-page-content .table",
  ".workspace-page-content .banner",".workspace-page-content .empty",
  ".workspace-page-content .comment-list",".workspace-page-content .ranking-source-card",
  ".workspace-page-content .quick"
 ])assert.ok(css.includes(token),token);
 assert.match(css,/scrollbar-color:#456f81 transparent/);
});

test("existing per-page workflows are preserved rather than replaced",()=>{
 for(const fragment of [
  'page==="dashboard"','page==="monitor"','page==="programs"','page==="comments"',
  'page==="requests"','page==="stocks"','page==="library"','page==="poll"',
  'page==="player"','page==="automation"','page==="external"','page==="remote"',
  'page==="audit"','page==="voice"','page==="users"','page==="logs"',
  'page==="changelog"','page==="settings"',
  "data-broadcast-comment-start","data-live-video-open",
  "data-ranking-monitor-check","data-poll-start","data-quote-next"
 ])assert.ok(renderer.includes(fragment),fragment);
});

test("small window layouts remain usable and can collapse into a horizontal menu",()=>{
 assert.match(css,/@media\(max-width:1400px\)/);
 assert.match(css,/@media\(max-width:1150px\)/);
 assert.match(css,/@media\(max-width:950px\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:500px\)/);
 assert.match(css,/\.sidebar nav\{\s*display:flex;align-items:center;gap:5px;\s*overflow-x:auto;overflow-y:hidden/);
 assert.match(css,/body\{\s*min-width:0/);
 assert.doesNotMatch(css.slice(css.lastIndexOf("/* ===============================================================")),/display:none.*\.workspace-card/);
});

test("new alpha follows continuous version numbering without upgrading to stable",()=>{
 assert.equal(pkg.version,"0.9.0-alpha.102");
 assert.match(preload,/version:"0\.9\.0-alpha\.102"/);
 assert.match(index,/ALPHA 102/);
 assert.match(index,/v0\.9\.0-alpha\.102/);
});
