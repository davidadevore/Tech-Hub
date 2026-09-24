const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {start}=require('../services/record/server.js');
test('live recorder settings preserve unchanged connections and state, reconcile devices, reject busy/invalid saves, and keep HTTP available',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'record-live-')),file=path.join(dir,'config.json');
 const envKeys=['TECH_HUB_MANAGED','TECH_HUB_BACKEND_PORT','TECH_HUB_BACKEND_HOST'],old=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.TECH_HUB_MANAGED='1';process.env.TECH_HUB_BACKEND_PORT='0';process.env.TECH_HUB_BACKEND_HOST='127.0.0.1';
 let cfg={devices:[{name:'A',type:'hyperdeck',host:'deck-a.invalid'},{name:'B',type:'kipro',host:'deck-b.invalid'}],pollIntervalMs:2000,controlEnabled:true,controlLocalOnly:true,allowFormat:false};
 const write=()=>fs.writeFileSync(file,JSON.stringify(cfg));write();const created=[];let server,finish;
 try{
 server=start(file,{controllerFactory:(dev,st,opts)=>{const entry={dev,st,opts,disposed:false,commands:0};created.push(entry);st.online=true;st.status='stopped';st.lastSeen=1234;return {dispose(){entry.disposed=true;},refreshSettings(){st.name=dev.name;},record(){entry.commands++;return new Promise(r=>{finish=()=>r('record started');});}};}});
 await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const status=()=>fetch(base+'/api/status',{headers:{'x-techhub-local-client':'1'}}).then(r=>r.json());
 const reload=(headers={})=>fetch(base+'/api/reload-config',{method:'POST',headers:{'Content-Type':'application/json','x-techhub-local-client':'1',...headers},body:'{}'});
 const before=await status();assert.equal(created.length,2);
 cfg={...cfg,pollIntervalMs:500,warnFreePercent:35,allowFormat:true,devices:[cfg.devices[1],{...cfg.devices[0],name:'Renamed A'}]};write();assert.equal((await reload()).status,200);
 const after=await status();assert.equal(created.length,2);assert.equal(created[0].disposed,false);assert.equal(created[0].opts.pollIntervalMs,500);assert.equal(after.devices[1].id,before.devices[0].id);assert.equal(after.devices[1].name,'Renamed A');assert.equal(after.devices[1].lastSeenAgoMs>=0,true);assert.equal(after.thresholds.warn,35);assert.equal(after.control.allowFormat,true);assert.equal(created.reduce((n,e)=>n+e.commands,0),0);
 cfg.devices=[cfg.devices[1],{name:'C',type:'hyperdeck',host:'deck-c.invalid'}];write();assert.equal((await reload()).status,200);assert.equal(created.length,3);assert.equal(created[1].disposed,true);assert.equal(created[0].disposed,false);
 cfg.devices[1].host='deck-d.invalid';write();assert.equal((await reload()).status,200);assert.equal(created.length,4);assert.equal(created[2].disposed,true);
 assert.equal((await reload({'x-techhub-local-client':'0'})).status,403);assert.equal((await reload({Origin:'http://evil.invalid'})).status,403);
 const action=fetch(base+'/api/control',{method:'POST',headers:{'Content-Type':'application/json','x-techhub-local-client':'1'},body:JSON.stringify({id:before.devices[0].id,action:'record'})});
 for(let i=0;i<50&&!finish;i++)await new Promise(r=>setTimeout(r,5));assert(finish);assert.equal((await reload()).status,409);finish();await action;
 cfg.devices=[{id:'same',type:'kipro',host:'a.invalid'},{id:'same',type:'kipro',host:'b.invalid'}];write();assert.equal((await reload()).status,400);assert.equal(created.length,4);assert.equal((await status()).devices.length,2);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}for(const k of envKeys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}fs.rmSync(dir,{recursive:true,force:true});}
 assert(created.every(e=>e.disposed));
});
