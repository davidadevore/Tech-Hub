const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {addModule}=require('../scripts/catalog-add.cjs'),{validateCatalog,createLibrary}=require('../hub/app-library.cjs'),{pack}=require('../sdk/package.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'catalog-review-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'module.zip'),m=pack(path.resolve('sdk/template'),file),bytes=fs.readFileSync(file);return {dir,bytes,entry:{...m,developer:'Example Developer',sourceUrl:'https://github.com/example/example-meter',packages:{universal:{url:'https://github.com/horner516/Tech-Hub/releases/download/catalog-fixture/module.zip',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length}}}};}
test('reviewed catalog addition checks exact bytes, metadata and version without executing code',t=>{
 const {bytes,entry}=fixture(t),empty={schemaVersion:1,apps:[]};const catalog=addModule(empty,entry,bytes);assert.equal(catalog.apps[0].developer,'Example Developer');assert.equal(empty.apps.length,0);
 assert.throws(()=>addModule(catalog,entry,bytes),/higher version/);
 assert.throws(()=>addModule(empty,{...entry,name:'Wrong manifest name'},bytes),/Manifest mismatch/);
 assert.throws(()=>addModule(empty,{...entry,permissions:['device-control']},bytes),/Permission mismatch/);
 assert.throws(()=>addModule(empty,entry,Buffer.from('wrong')),/checksum/);
 assert.throws(()=>validateCatalog({schemaVersion:1,apps:[{...entry,sourceUrl:'javascript:alert(1)'}]}),/source URL/);
 assert.throws(()=>validateCatalog({schemaVersion:1,apps:[{...entry,developer:{name:'bad'}}]}),/developer/);
});
test('catalog-only refresh discovers a new module on an existing host without installing it',async t=>{
 const {dir,bytes,entry}=fixture(t);let downloads=0;
 const catalogURL='https://github.com/horner516/Tech-Hub/releases/download/catalog-fixture/tech-hub-catalog.json';
 const lib=createLibrary({dir,hostVersion:'1.0.2',platform:'win32-x64',request:async url=>{
  if(url.includes('/repos/'))return new Response(JSON.stringify([{draft:false,prerelease:false,published_at:'2026-10-07',assets:[{name:'tech-hub-catalog.json',browser_download_url:catalogURL}]}]));
  if(url===catalogURL)return new Response(JSON.stringify({schemaVersion:1,apps:[entry]}));downloads++;return new Response(bytes);
 }});t.after(()=>lib.stop());await lib.refresh();const a=lib.snapshot().apps[0];assert.equal(a.name,entry.name);assert.equal(a.developer,entry.developer);assert.equal(a.compatible,true);assert.equal(a.installedVersion,null);assert.equal(downloads,0);
 await lib.run([entry.id]);assert.equal(downloads,1);assert.equal(lib.read(entry.id).manifest.version,entry.version);
});
