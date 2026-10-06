const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAdminAccess,validate}=require('../hub/admin-access.cjs');
const {createViewers}=require('../hub/viewers.cjs');
const {startHub,loadConfig}=require('../hub/server.cjs');
test('administrator sessions expire, bind to the actual client, revoke, and throttle guesses',async()=>{
 let now=1000,config={enabled:true,password:{hash:'fixture'}};const access=createAdminAccess({getConfig:()=>config,now:()=>now,verify:async(p)=>p==='1234'}),req={headers:{},socket:{remoteAddress:'192.0.2.1'}};
 const result=await access.login(req,'1234');assert.equal(result.status,303);req.headers.cookie=result.cookie.split(';')[0];assert(access.authorized(req));assert(!access.authorized({...req,socket:{remoteAddress:'192.0.2.2'}}));
 now+=3600000;assert(!access.authorized(req));req.headers.cookie=(await access.login(req,'1234')).cookie.split(';')[0];access.revoke();assert(!access.authorized(req));
 for(let i=0;i<10;i++)assert.equal((await access.login(req,'wrong')).status,401);assert.equal((await access.login(req,'1234')).status,429);now+=60000;assert.equal((await access.login(req,'1234')).status,303);
 config.enabled=false;assert(!access.authorized(req));assert.equal((await access.login(req,'1234')).status,403);assert.throws(()=>validate({enabled:true,password:null}));
});
test('viewer tracking groups actual IPs and services, expires inactive pages, and removes disabled services',()=>{
 let now=0;const tracker=createViewers({now:()=>now});const req=id=>({headers:{'x-techhub-viewer':id,'x-forwarded-for':'fake'},socket:{remoteAddress:'::ffff:192.0.2.1'}});
 assert.equal(tracker.touch(req('bad'),'dsan'),false);tracker.touch(req('page-123456'),'dsan');tracker.touch(req('page-abcdef'),'dsan');tracker.touch(req('page-123456'),'power');assert.equal(tracker.list().length,2);assert.equal(tracker.list()[0].ip,'192.0.2.1');assert.equal(tracker.list()[0].sessions,2);tracker.remove('power');assert.equal(tracker.list().length,1);now=60000;assert.deepEqual(tracker.list(),[]);
});
function request(port,host,url,method='GET',body,headers={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{Host:host,...headers,...(body!==undefined?{'Content-Type':typeof body==='string'?'application/x-www-form-urlencoded':'application/json'}:{})}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body));});}
test('remote administration defaults off, requires four characters, gates APIs, grants service settings, and revokes immediately',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'th-admin-'));let hub,backend;
 try{
  const c=loadConfig(dir);c.host='127.0.0.1';c.adminPort=31800;Object.values(c.services).forEach((s,i)=>Object.assign(s,{port:31801+i,backendPort:31811+i}));backend=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({admin:req.headers['x-techhub-local-client']}));});await new Promise(r=>backend.listen(0,'127.0.0.1',r));c.services.record.backendPort=backend.address().port;fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(c));hub=await startHub({dir,launch:false});const port=hub.config.adminPort,local='127.0.0.1:'+port,remote='tech.local:'+port;
  assert.equal((await request(port,remote,'/api/status')).status,403);
  assert.equal((await request(port,local,'/api/admin-access','POST',{enabled:true,password:'123'})).status,400);
  assert.equal((await request(port,local,'/api/admin-access','POST',{enabled:true,password:'1234'},{Origin:'http://evil.invalid'})).status,403);
  assert.equal((await request(port,local,'/api/admin-access','POST',{enabled:true,password:'1234'})).status,200);
  assert(!fs.readFileSync(path.join(dir,'config.json'),'utf8').includes('1234'));
  assert.equal((await request(port,remote,'/api/status')).status,401);assert.equal((await request(port,remote,'/api/viewers')).status,401);
  assert.equal((await request(port,remote,'/login','POST','password=wrong')).status,401);
  const login=await request(port,remote,'/login','POST','password=1234');assert.equal(login.status,303);const Cookie=login.headers['set-cookie'][0].split(';')[0];
  const status=await request(port,remote,'/api/status','GET',undefined,{Cookie});assert.equal(status.status,200);assert.equal(JSON.parse(status.text).localAdmin,false);assert(!status.text.includes('hash'));
  assert.equal((await request(port,'evil.invalid:'+port,'/api/status','GET',undefined,{Cookie})).status,403);
  assert.equal((await request(port,remote,'/api/enabled','POST',{id:'power',enabled:false},{Cookie})).status,200);
  const service=hub.config.services.record.port;
  assert.equal(JSON.parse((await request(service,'tech.local:'+service,'/api/example','GET',undefined,{Cookie})).text).admin,'1');
  assert.equal(JSON.parse((await request(service,'tech.local:'+service,'/api/example','GET',undefined,{'x-techhub-local-client':'1'})).text).admin,'0');
  assert.equal((await request(service,'tech.local:'+service,'/__hub/settings')).status,403);
  assert.equal((await request(service,'tech.local:'+service,'/__hub/settings','GET',undefined,{Cookie})).status,200);
  assert.equal((await request(service,'tech.local:'+service,'/__hub/heartbeat','POST',undefined,{'x-techhub-viewer':'viewer-123456'})).status,200);
  const viewers=JSON.parse((await request(port,remote,'/api/viewers','GET',undefined,{Cookie})).text).viewers;assert.equal(viewers[0].service,'record');assert.equal(viewers[0].ip,'127.0.0.1');
  assert.equal((await request(port,local,'/api/admin-access','POST',{enabled:false,password:''})).status,200);
  assert.equal((await request(port,remote,'/api/status','GET',undefined,{Cookie})).status,403);assert.equal((await request(service,'tech.local:'+service,'/__hub/settings','GET',undefined,{Cookie})).status,403);
 }finally{await hub?.stop();if(backend)await new Promise(r=>{backend.closeAllConnections();backend.close(r);});fs.rmSync(dir,{recursive:true,force:true});}
});
