"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const workflow=fs.readFileSync(path.join(root,".github/workflows/windows-build.yml"),"utf8");
const pkg=require("../package.json");
test("alpha releases publish from main only after the Windows build",()=>{
 assert.match(pkg.version,/^\d+\.\d+\.\d+-alpha\.\d+$/);
 assert.match(workflow,/publish-release:\s*\n\s*if:.*github\.event_name == 'push'.*github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/needs: build-windows/);
 assert.match(workflow,/permissions:\s*\n\s*contents: write/);
 assert.match(workflow,/getBranch\(\{owner, repo, branch:"main"\}\)/);
 assert.match(workflow,/prerelease: tag\.includes\("-"\)/);
 assert.match(workflow,/installer \|\| !portable/);
 assert.match(workflow,/manifests\.some\(file => !files\.includes\(file\)\)/);
 assert.match(workflow,/dist\/\*\.yml/);
});
test("alpha release still maintains tag-initiated publication",()=>{
 assert.match(workflow,/startsWith\(github\.ref, 'refs\/tags\/v'\)/);
 assert.match(workflow,/tag\.slice\(1\) !== version/);
 assert.match(workflow,/Release .* already points to a different revision/);
});
