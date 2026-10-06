const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const runtime=require('../hub/runtime-api.cjs');
const load=file=>import('../services/rtoo/'+file+'.js');
const until=async(fn)=>{for(let n=0;n<100;n++){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.fail('Timed out waiting for fixture');};
test('R-Too settings validate addresses, deduplicate and preserve explicit ports',async()=>{
 const {validateSettings,endpoint}=await load('settings');
 const s=validateSettings({discovery:false,hosts:['10.1.1.1','amp.local:50014','10.1.1.1:30013','[::1]:30013']});
 assert.deepEqual(s.hosts,['10.1.1.1:30013','amp.local:50014','[::1]:30013']);assert.deepEqual(endpoint('[::1]:30013'),{host:'::1',port:30013});
 for(const entry of ['http://amp.local','amp.local:65536','amp.local:0','a/../../b'])assert.throws(()=>validateSettings({discovery:true,hosts:[entry]}));
 assert.throws(()=>validateSettings({discovery:'yes',hosts:[]}));
});
test('portable discovery filters non-amplifiers, uses advertised port, cleans up',async()=>{
 const {parseService,startDiscovery}=await load('discovery');const s={name:'Amp',port:50014,addresses:['fe80::1','10.1.1.20'],txt:{db_serialnumber:'Z123',db_firmwarevers:'D40 V1',db_devicename:'Stage'}};
 assert.equal(parseService(s).model,'D40');assert.equal(parseService(s).port,50014);assert.equal(parseService({...s,txt:{}}),null);assert.equal(parseService({...s,port:0}),null);
 let result,stopped=false,destroyed=false;
 class Fixture{find(options,callback){assert.equal(options.type,'oca');callback(s);return {update(){},stop(){stopped=true;}};}destroy(){destroyed=true;}}
 const stop=startDiscovery(d=>result=d,()=>{},Fixture);assert.equal(result.serial,'Z123');stop();assert(stopped&&destroyed);
});
test('fleet reconnects, clears stale values and closes removed connections',async()=>{
 const {createFleet}=await load('fleet');let connections=[],watchStops=0;
 const fleet=createFleet({retryMs:10,connect:async()=>{const c=new EventEmitter();c.close=()=>c.emit('close');connections.push(c);return c;},deviceFactory:()=>({set_keepalive_interval(){},async get_role_map(){return new Map([['ChStatus/ChStatus_Isp1',{}]]);}}),watch:({amp})=>{amp.channels[0].outputPowerW=10;return ()=>watchStops++;}});
 try{fleet.add({serial:'fixture',host:'127.0.0.1',port:30013});await until(()=>fleet.snapshot().fixture?.connected);assert.equal(fleet.snapshot().fixture.channels[0].outputPowerW,10);
 assert(fleet.suppress('fixture','smpsError',true));assert(!fleet.suppress('fixture','other',true));connections[0].close();await until(()=>connections.length===2&&fleet.snapshot().fixture.connected);assert(watchStops>=1);fleet.remove('fixture');assert.deepEqual(fleet.snapshot(),{});
 }finally{fleet.stop();}
});
test('hung role discovery releases its slot and retries, stopping cancels workers',async()=>{
 const {createFleet}=await load('fleet');let count=0,closed=0;
 const fleet=createFleet({retryMs:5,timeoutMs:20,connect:async()=>{count++;const c=new EventEmitter();c.close=()=>{closed++;c.emit('close');};return c;},deviceFactory:()=>({set_keepalive_interval(){},get_role_map(){return new Promise(()=>{});}})});
 fleet.add({serial:'fixture',host:'127.0.0.1',port:30013});await until(()=>count>=2);fleet.stop();const after=count;await new Promise(r=>setTimeout(r,40));assert.equal(count,after);assert(closed>0);
});
test('module settings require admin/origin, save live, and never discover by default',async()=>{
 const {createModule}=await load('server');let saved={discovery:false,hosts:[]},applies=0,scans=0,stops=0;
 const mod=createModule({runtimeApi:{...runtime,readSettings:()=>saved,saveSettings:s=>saved=s},fleetFactory:()=>{applies++;return {add(){},snapshot:()=>({}),stop(){stops++;},suppress:()=>true};},discover:()=>{scans++;return ()=>{};}});
 await new Promise(r=>mod.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+mod.server.address().port;
 try{assert.equal(scans,0);assert.equal((await fetch(base+'/api/settings')).status,403);const headers={'x-techhub-local-client':'1','Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/settings',{method:'POST',headers:{...headers,Origin:'http://evil.invalid'},body:JSON.stringify({discovery:true,hosts:[]})})).status,403);
 assert.equal((await fetch(base+'/api/settings',{method:'POST',headers,body:JSON.stringify({discovery:true,hosts:['amp.local:50014']})})).status,200);assert.equal(scans,1);assert.equal(applies,2);assert.equal(saved.hosts[0],'amp.local:50014');assert.equal(stops,1);
 assert.equal((await fetch(base+'/api/settings',{method:'POST',headers,body:JSON.stringify({discovery:true,hosts:['bad/path']})})).status,400);assert.equal(applies,2);
 assert.equal((await fetch(base+'/api/suppress-flag',{method:'POST',body:'{}'})).status,403);assert.equal((await fetch(base+'/state')).status,200);assert.match(await fetch(base).then(r=>r.text()),/R-Too/);
 }finally{await mod.stop();}
});
test('packaged module launches behind host gateway, preserves settings and enforces access',async()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
 const {stageRtoo}=require('../scripts/package-rtoo.cjs'),{pack}=require('../sdk/package.cjs'),{inspectPackage}=require('../hub/app-package.cjs');
 const {createLibrary}=require('../hub/app-library.cjs'),{loadConfig,startHub}=require('../hub/server.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rtoo-integration-'));let hub;
 try{
  const stage=path.join(dir,'stage'),seed=path.join(dir,'seed');fs.mkdirSync(seed);stageRtoo(stage);const file=path.join(seed,'rtoo.zip');pack(stage,file);const bytes=fs.readFileSync(file);
  for(const platform of ['darwin-arm64','win32-x64'])assert.equal(inspectPackage(bytes,{hostVersion:'1.0.2',platform}).name,'R-Too');
  fs.writeFileSync(path.join(seed,'catalog.json'),JSON.stringify({schemaVersion:1,apps:[{...require('../services/rtoo/techhub-app.json'),packages:{universal:{url:'https://github.com/horner516/Tech-Hub/releases/download/fixture/rtoo.zip',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}}}]}));
  const data=path.join(dir,'data'),lib=createLibrary({dir:data,hostVersion:'1.0.2'});await lib.seed(seed);await lib.stop();const c=loadConfig(data);c.host='127.0.0.1';c.adminPort=32700;
  for(const [i,s]of Object.values(c.services).entries())Object.assign(s,{enabled:false,port:32701+i,backendPort:32711+i});c.services.rtoo.enabled=true;fs.writeFileSync(path.join(data,'config.json'),JSON.stringify(c));
  hub=await startHub({dir:data,modular:true,advertise:false,checkUpdates:false,seedDir:seed,libraryOptions:{request:async()=>{throw Error('Offline fixture');}}});
  await until(()=>hub.status().services.find(s=>s.id==='rtoo').state==='running');const base=hub.status().services.find(s=>s.id==='rtoo').localURL;
  assert.match(await fetch(base).then(r=>r.text()),/\/__hub\/chrome.js/);assert.equal((await fetch(base+'/state').then(r=>r.json())).admin,true);
  const payload={discovery:false,hosts:[]};assert.equal((await fetch(base+'/api/settings',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(payload)})).status,200);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data,'rtoo/settings.json'))),payload);
  assert.equal((await fetch('http://127.0.0.1:'+hub.config.services.rtoo.backendPort+'/api/settings')).status,403);
  assert.equal((await fetch(base+'/api/settings',{method:'POST',headers:{Origin:'http://evil.invalid'},body:JSON.stringify(payload)})).status,403);
 }finally{await hub?.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
