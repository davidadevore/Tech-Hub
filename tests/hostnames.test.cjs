const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {installationId,createHostnames,serviceHostname,validateNaming}=require('../hub/hostnames.cjs');
test('LAN hostnames persist per installation, follow enabled services/ports and interfaces, and withdraw on shutdown',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'th-names-'));let manager;
 try{
  const id=installationId(dir);assert.equal(installationId(dir),id);assert.match(id,/^[a-f0-9]{12}$/);
  let services=[{id:'dsan',name:'Dsan',enabled:true,port:8709},{id:'lux',name:'Lux',enabled:false,port:8702}];
  let address='192.168.10.2';const instances=[];
  manager=createHostnames({dir,getServices:()=>services,interfaces:()=>({eth:[{address,family:'IPv4',internal:false,mac:'aa:bb:cc:dd:ee:ff'}]}),factory:()=>{const b={published:[],closed:false,withdrawn:false,publish(options){const s=new EventEmitter();this.published.push({options,s});process.nextTick(()=>s.emit('up'));return s;},unpublishAll(cb){this.withdrawn=true;cb();},destroy(){this.closed=true;}};instances.push(b);return b;}});
  await manager.sync();await new Promise(r=>setImmediate(r));assert.equal(instances[0].published.length,1);
  assert.equal(manager.info('dsan').hostnameURL,'http://dsan.local:8709');assert.equal(manager.info('lux').hostnameURL,null);
  assert.deepEqual(instances[0].published[0].options.txt,{path:'/'});assert.equal(instances[0].published[0].options.disableIPv6,true);
  services=[{id:'lux',name:'Lux',enabled:true,port:8712}];await manager.sync();await new Promise(r=>setImmediate(r));assert(instances[0].withdrawn&&instances[0].closed);assert.equal(manager.info('dsan').hostnameURL,null);assert.match(manager.info('lux').hostnameURL,/:8712$/);
  address='192.168.20.2';await manager.sync();assert.equal(instances.length,3);
  await manager.stop();assert(instances.every(b=>b.withdrawn&&b.closed));assert.equal(manager.info('lux').hostnameURL,null);
 }finally{await manager?.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
test('short names validate identifiers, omit HTTP port 80, and republish after renaming',async()=>{
 assert.equal(serviceHostname('power'),'pd.local');assert.equal(serviceHostname('master','stage1'),'tech-stage1.local');
 assert.equal(validateNaming({suffix:' Stage-1 ',portless:true}).suffix,'stage-1');
 assert.equal(validateNaming({suffix:'',portless:true,names:{dsan:' DSAN1.local '}}).names.dsan,'dsan1');
 for(const names of [{dsan:'lux.local'},{dsan:'TECH.local'},{dsan:''},{dsan:'http://dsan.local'},{dsan:'a.b.local'},{dsan:'a'.repeat(64)},{dsan:42},{unknown:'foo'}])assert.throws(()=>validateNaming({suffix:'',portless:true,names}));
 assert.throws(()=>validateNaming({suffix:'stage1',portless:true,names:{dsan:'a'.repeat(58)}}));
 assert.equal(serviceHostname('dsan','stage1',{dsan:'dsan1'}),'dsan1-stage1.local');
 for(const suffix of ['../bad','bad.local','-bad','bad-','a'.repeat(33)])assert.throws(()=>validateNaming({suffix,portless:true}));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'th-short-'));let manager,suffix='',names={};
 try{
  manager=createHostnames({dir,getSuffix:()=>suffix,getNames:()=>names,getServices:()=>[{id:'power',name:'Power',port:80,enabled:true}],interfaces:()=>({eth:[{family:'IPv4',address:'192.168.1.2',internal:false}]}),factory:()=>({publish(){const s=new EventEmitter();process.nextTick(()=>s.emit('up'));return s;},unpublishAll(cb){cb();},destroy(){}})});
  await manager.sync();await new Promise(r=>setImmediate(r));assert.equal(manager.info('power').hostnameURL,'http://pd.local');
  suffix='stage1';await manager.sync();await new Promise(r=>setImmediate(r));assert.equal(manager.info('power').hostnameURL,'http://pd-stage1.local');
  names={power:'power1'};await manager.sync();await new Promise(r=>setImmediate(r));assert.equal(manager.info('power').hostnameURL,'http://power1-stage1.local');
 }finally{await manager?.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
test('a conflicting hostname is not published, and a later conflict withdraws an advertised name',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'th-conflict-'));let manager,stopped=0;const mdns=new EventEmitter(),published=[];
 mdns.query=()=>mdns.emit('response',{answers:[{name:'DSAN.local',type:'A',data:'192.168.1.99',ttl:120}]});
 try{
  manager=createHostnames({dir,probeMs:3,getServices:()=>['dsan','lux'].map(id=>({id,name:id,port:80,enabled:true})),interfaces:()=>({eth:[{family:'IPv4',address:'192.168.1.2',internal:false}]}),factory:()=>({server:{mdns},publish(options){published.push(options.host);const s=new EventEmitter();s.stop=()=>stopped++;process.nextTick(()=>s.emit('up'));return s;},unpublishAll(cb){cb();},destroy(){mdns.removeAllListeners();}})});
  await manager.sync();await new Promise(r=>setImmediate(r));assert.deepEqual(published,['lux.local']);assert.equal(manager.info('dsan').hostnameStatus,'conflict');assert.equal(manager.info('dsan').hostnameURL,null);
  assert.equal(manager.info('lux').hostnameURL,'http://lux.local');
  mdns.emit('response',{answers:[{name:'lux.local',type:'A',data:'192.168.1.3',ttl:120}]});
  assert.equal(manager.info('lux').hostnameStatus,'conflict');assert.equal(manager.info('lux').hostnameURL,null);assert.equal(stopped,1);
 }finally{await manager?.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
test('mDNS failures leave IP-based service operation available and never claim a hostname is advertised',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'th-names-fail-'));let manager;
 try{manager=createHostnames({dir,getServices:()=>[{id:'record',name:'Record',enabled:true,port:8705}],interfaces:()=>({eth:[{address:'192.168.1.1',family:'IPv4',internal:false}]}),factory:()=>{throw Error('UDP unavailable');}});await manager.sync();assert.equal(manager.info('record').hostnameStatus,'unavailable');assert.equal(manager.info('record').hostnameURL,null);}finally{await manager?.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
