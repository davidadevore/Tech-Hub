const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const resources=path.resolve(process.argv[2]);process.env.TECH_HUB_RESOURCES=resources;
const {startHub,loadConfig,hashPassword}=require(path.join(resources,'hub/server.cjs'));
(async()=>{const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'tech-hub-smoke-'));let hub;const blockers=[];
try {
 const c=loadConfig(dir);c.host='127.0.0.1';c.adminPort=30700;
 ['dsan','lux','power'].forEach((id,i)=>Object.assign(c.services[id],{port:30701+i,backendPort:30711+i}));
 c.services.lux.password=await hashPassword('smoke-test-only');fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(c));
 for(const port of [30700,30702,30711]){const server=http.createServer((req,res)=>res.end('unrelated'));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});blockers.push(server);}
 hub=await startHub({dir});
 for(let i=0;i<100&&!hub.status().services.every(s=>s.state==='running');i++)await new Promise(r=>setTimeout(r,300));
 assert(hub.status().services.every(s=>s.state==='running'),JSON.stringify(hub.status()));
 assert.notEqual(hub.config.adminPort,30700);assert.notEqual(hub.config.services.lux.port,30702);assert.notEqual(hub.config.services.dsan.backendPort,30711);
 const admin=`http://127.0.0.1:${hub.config.adminPort}`;
 assert.match(await fetch(admin+'/app.js').then(r=>r.text()),/Set password/);
 for(const s of hub.status().services){const r=await fetch(s.localURL);assert.equal(r.status,s.id==='lux'?401:200);}
 const lux=hub.status().services.find(s=>s.id==='lux').localURL;
 const login=await fetch(lux+'/__hub/login',{method:'POST',body:new URLSearchParams({password:'smoke-test-only'}),redirect:'manual'});assert.equal(login.status,303);
 assert.equal((await fetch(lux,{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}})).status,200);
 console.log('PASS: bundled services running on reassigned ports; password gate and login verified; Set password label bundled.');
} catch(e){console.error('Smoke logs: '+dir);throw e;} finally {await hub?.stop();await Promise.all(blockers.map(s=>new Promise(r=>{s.closeAllConnections();s.close(r);})));}
})().catch(e=>{console.error(e);process.exitCode=1;});
