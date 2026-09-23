const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createUpdateChecker}=require('../hub/updates.cjs');
const release=(tag,extras={})=>({tag_name:tag,body:`Changes in ${tag}`,assets:[{name:'Tech-Hub-macOS-arm64.dmg'},{name:'Tech-Hub-Windows-x64-Setup.exe'}],...extras});
const response=list=>({ok:true,json:async()=>list});
test('collects every skipped desktop release in semantic order, ignoring Companion, previews, drafts and incomplete builds',async()=>{
 const checker=createUpdateChecker('0.3.9',{request:async()=>response([
   release('v0.4.0'),release('v0.3.9'),release('companion-v2.0.0'),release('v0.10.0'),release('v1.0.0-beta.1'),
   release('v2.0.0',{prerelease:true}),release('v3.0.0',{draft:true}),release('v4.0.0',{assets:[]})
 ])});
 const result=await checker.check();assert.equal(result.status,'ready');assert.equal(result.latestVersion,'0.10.0');assert(result.available);
 assert.deepEqual(result.releases.map(r=>r.version),['0.10.0','0.4.0']);assert.equal(result.releases[1].notes,'Changes in v0.4.0');
});
test('does not offer a downgrade or an equal-version update',async()=>{
 for(const current of ['0.4.0','0.5.0']){
   const result=await createUpdateChecker(current,{request:async()=>response([release('v0.4.0')])}).check();
   assert.equal(result.available,false);assert.deepEqual(result.releases,[]);
 }
});
test('paginates despite Companion releases and handles absent notes safely',async()=>{
 let calls=0;
 const checker=createUpdateChecker('0.3.0',{request:async url=>{
   calls++;assert.match(url,new RegExp(`page=${calls}$`));
   return response(calls===1?Array.from({length:100},()=>release('companion-v1.0.0')):[release('v0.4.0',{body:null})]);
 }});
 const result=await checker.check();assert.equal(calls,2);assert(result.available);assert.match(result.releases[0].notes,/No release notes/);
});
test('deduplicates overlapping checks, throttles retries and preserves known update notes after a network failure',async()=>{
 let time=0,calls=0,resolve;
 const checker=createUpdateChecker('0.3.0',{now:()=>time,request:()=>{calls++;return calls===1?new Promise(r=>{resolve=r;}):Promise.reject(new TypeError('offline'));}});
 const first=checker.check(),second=checker.check();assert.equal(first,second);assert.equal(checker.snapshot().status,'checking');
 resolve(response([release('v0.4.0')]));await first;await checker.check();assert.equal(calls,1);
 time=61000;const failed=await checker.check();assert.equal(calls,2);assert.equal(failed.status,'error');assert(failed.available);assert.match(failed.error,/internet/);assert.equal(failed.releases.length,1);
});
test('reports rate limits, malformed results and unpublished releases without claiming to be up to date',async()=>{
 for(const value of [{ok:false,status:403},response({}),response([])]){
   const result=await createUpdateChecker('0.4.0',{request:async()=>value}).check();assert.equal(result.status,'error');assert.equal(result.checkedAt,null);
 }
});
test('shutdown aborts the in-flight network request',async()=>{
 const checker=createUpdateChecker('0.4.0',{request:(_,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError'))))});
 const pending=checker.check();checker.stop();assert.equal((await pending).status,'error');
});
