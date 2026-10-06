const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {init,check,stage,context}=require('../sdk/dev.cjs'),{serve}=require('../sdk/preview.cjs');
function tmp(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'sdk-tools-test-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('scaffold is non-destructive and structured checks omit repo metadata but reject secrets',t=>{
 const root=tmp(t),app=path.join(root,'meter');init(app,'fixture-meter','Fixture Meter');assert.throws(()=>init(app,'fixture-meter','Fixture'),/exists/);assert.equal(context(app).module.id,'fixture-meter');
 fs.mkdirSync(path.join(app,'.git'));fs.writeFileSync(path.join(app,'.git/config'),'fixture');assert(check(app).ok);
 fs.writeFileSync(path.join(app,'bad.js'),'const broken = ;');const result=check(app);assert.equal(result.ok,false);assert.equal(result.errors[0].code,'SYNTAX');assert(!result.errors[0].message.includes(os.tmpdir()+'techhub-sdk-check'));fs.unlinkSync(path.join(app,'bad.js'));
 fs.writeFileSync(path.join(app,'.env'),'FAKE=fixture');assert.throws(()=>check(app),/secrets/);
});
test('standalone previews use temporary settings and cannot spoof viewer privileges',async t=>{
 const root=tmp(t),app=path.join(root,'meter');init(app,'fixture-meter','Fixture Meter');fs.mkdirSync(path.join(app,'.git'));
 const admin=await serve(app,{report:false});
 try{assert.equal((await fetch(admin.url)).status,200);assert.equal((await fetch(admin.url+'/api/status').then(r=>r.json())).admin,true);
 const post=(headers={})=>fetch(admin.url+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({label:'Saved fixture'})});assert.equal((await post({Origin:'http://other.invalid'})).status,403);assert.equal((await post({Origin:admin.url})).status,200);assert.equal(JSON.parse(fs.readFileSync(path.join(admin.data,'settings.json'))).label,'Saved fixture');
 }finally{await admin.close();}assert(!fs.existsSync(admin.data));assert(!fs.existsSync(path.join(app,'settings.json')));
 const viewer=await serve(app,{viewer:true,report:false});try{assert.equal((await fetch(viewer.url+'/api/status',{headers:{'x-techhub-local-client':'1'}}).then(r=>r.json())).admin,false);assert.equal((await fetch(viewer.url+'/api/settings',{method:'POST',headers:{'x-techhub-local-client':'1'},body:'{"label":"bad"}'})).status,403);}finally{await viewer.close();}
});
