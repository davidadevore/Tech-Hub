const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {startHub,loadConfig,definitions}=require('../hub/server.cjs');
const {createNamedRouter}=require('../hub/named-router.cjs');
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',r));
const close=server=>new Promise(r=>{server.closeAllConnections();server.close(r);});
function request(port,host,url='/',method='GET',body,extra={}){return new Promise((resolve,reject)=>{
 const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{Host:host,...(body?{'Content-Type':'application/json'}:{}),...extra}},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
});}
test('short hostname routes retain password, disabled, origin and local-only gates; renaming persists and removes old routes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'th-routing-'));let hub;const backends=[];
 try{
  const config=loadConfig(dir);config.adminPort=31500;
  for(const [i,d] of definitions.entries()){
   const backend=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:d.id,local:req.headers['x-techhub-local-client']}));});await listen(backend);backends.push(backend);
   Object.assign(config.services[d.id],{port:31501+i,backendPort:backend.address().port});
  }
  fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(config));
  hub=await startHub({dir,launch:false,advertise:true,namedPort:0,hostnameOptions:{interfaces:()=>({eth:[{address:'192.168.2.3',family:'IPv4',internal:false}]}),factory:()=>({publish(){const s=new EventEmitter();process.nextTick(()=>s.emit('up'));return s;},unpublishAll(cb){cb();},destroy(){}})}});
  let port=hub.status().naming.port;const admin=hub.config.adminPort;
  const post=(url,value,extra={})=>request(admin,'127.0.0.1:'+admin,url,'POST',value,extra);
  assert.equal((await request(port,'unrelated.local')).status,421);
  assert.equal((await request(port,'dsan.local:9999')).status,421);
  assert.equal(JSON.parse((await request(port,'dsan.local')).text).service,'dsan');
  assert.equal(JSON.parse((await request(port,'pd.local')).text).service,'power');
  assert.equal((await request(port,'record.local','/__hub/settings')).status,403);
  assert.equal((await request(port,'tech.local','/api/status')).status,404);
  assert.match((await request(port,'tech.local')).text,/Choose an application/);
  assert.equal((await request(port,'dsan.local','/','GET',undefined,{Origin:'http://evil.invalid'})).status,403);
  assert.equal((await post('/api/access',{id:'dsan',password:'fixture-password'})).status,200);
  assert.equal((await request(port,'dsan.local')).status,401);
  assert.equal((await post('/api/enabled',{id:'power',enabled:false})).status,200);
  assert.equal((await request(port,'pd.local')).status,503);
  assert.doesNotMatch((await request(port,'tech.local')).text,/Power Monitor/);
  assert.equal((await post('/api/enabled',{id:'power',enabled:true})).status,200);
  assert.equal((await post('/api/naming',{suffix:'bad.local',portless:true})).status,400);
  assert.equal((await post('/api/naming',{suffix:'stage1',portless:true},{Origin:'http://evil.invalid'})).status,403);
  assert.equal((await post('/api/naming',{suffix:' Stage1 ',portless:true})).status,200);
  port=hub.status().naming.port;
  assert.equal(loadConfig(dir).naming.suffix,'stage1');
  assert.equal((await request(port,'pd.local')).status,421);
  assert.equal(JSON.parse((await request(port,'pd-stage1.local')).text).service,'power');
  assert.equal((await request(port,'dsan-stage1.local')).status,401);
  assert.equal((await post('/api/naming',{suffix:'stage1',portless:true,names:{dsan:'pd.local'}})).status,400);
  assert.equal((await post('/api/naming',{suffix:'stage1',portless:true,names:{dsan:'DSAN1.local',power:'power1',master:'show.local'}})).status,200);
  port=hub.status().naming.port;
  assert.equal(loadConfig(dir).naming.names.dsan,'dsan1');
  assert.equal((await request(port,'dsan-stage1.local')).status,421);
  assert.equal((await request(port,'dsan1-stage1.local')).status,401);
  assert.equal(JSON.parse((await request(port,'power1-stage1.local')).text).service,'power');
  assert.equal((await request(port,'tech-stage1.local')).status,421);
  assert.match((await request(port,'show-stage1.local')).text,/Choose an application/);
  const navigation=JSON.parse((await request(port,'power1-stage1.local','/__hub/navigation')).text);
  assert.match(navigation.services.find(s=>s.id==='power').hostnameURL,/power1-stage1\.local/);
  assert.equal((await post('/api/naming',{suffix:'stage1',portless:false})).status,200);
  assert.equal(loadConfig(dir).naming.names.dsan,'dsan1');
  assert.equal(hub.status().naming.available,false);
  assert.equal((await request(hub.status().services.find(s=>s.id==='power').port,'127.0.0.1')).status,200);
 }finally{await hub?.stop();await Promise.all(backends.map(close));fs.rmSync(dir,{recursive:true,force:true});}
});
test('occupied shared port fails gracefully and can be retried without replacing another listener',async()=>{
 const blocker=http.createServer((req,res)=>res.end('Existing app'));await listen(blocker);
 const port=blocker.address().port,router=createNamedRouter({host:'127.0.0.1',port,getRoutes:()=>new Map(),directory(){}});
 try{await router.start();assert.equal(router.state.available,false);assert.match(router.state.error,/in use/);assert.equal((await request(port,'localhost')).text,'Existing app');await close(blocker);await router.start();assert.equal(router.state.available,true);}finally{await router.stop();if(blocker.listening)await close(blocker);}
});
