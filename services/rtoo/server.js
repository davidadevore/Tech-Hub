import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createFleet } from './fleet.js';
import { defaults,validateSettings,endpoint } from './settings.js';
import { startDiscovery } from './discovery.js';
const require=createRequire(import.meta.url);
const runtime=require(process.env.TECH_HUB_RUNTIME_API||'../../hub/runtime-api.cjs');
export function createModule({runtimeApi=runtime,fleetFactory=createFleet,discover=startDiscovery}={}){
 let settings=validateSettings(runtimeApi.readSettings(defaults)),fleet,stopDiscovery,discoveryError=null;
 function apply(){stopDiscovery?.();stopDiscovery=null;fleet?.stop();fleet=fleetFactory();discoveryError=null;
  for(const entry of settings.hosts)fleet.add({serial:'manual:'+entry,deviceName:entry,model:'?',...endpoint(entry)});
  if(settings.discovery)try{stopDiscovery=discover(d=>fleet.add(d),e=>{discoveryError=e.message;});}catch(e){discoveryError=e.message;}
 }
 apply();
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>runtimeApi.json(res,status,value),admin=runtimeApi.isAdministrator(req);
  const url=new URL(req.url,'http://localhost').pathname;
  try{
   if(req.method==='GET'&&url==='/state')return json(200,{amps:fleet.snapshot(),admin,discovery:settings.discovery,discoveryError});
   if(url==='/api/settings'||url==='/api/suppress-flag'){
    if(!admin)return json(403,{error:'Administrator access required'});
    if(req.method==='GET'&&url==='/api/settings')return json(200,settings);
    if(req.method!=='POST')return json(405,{error:'Method not allowed'});
    if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host))return json(403,{error:'Origin rejected'});
    const value=await runtimeApi.readJSON(req,16384);
    if(url==='/api/settings'){const next=validateSettings(value);runtimeApi.saveSettings(next);settings=next;apply();return json(200,{ok:true});}
    if(typeof value.suppressed!=='boolean'||typeof value.serial!=='string'||typeof value.flag!=='string')return json(400,{error:'Invalid acknowledgement'});
    const ok=fleet.suppress(value.serial,value.flag,value.suppressed);return json(ok?200:404,{ok});
   }
   const assets={'/':['index.html','text/html; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
   if(req.method==='GET'&&assets[url]){const [file,type]=assets[url];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(await readFile(new URL('./public/'+file,import.meta.url)));}
   json(404,{error:'Not found'});
  }catch(e){json(400,{error:e.message});}
 });
 return {server,stop(){stopDiscovery?.();fleet.stop();server.closeAllConnections();return new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&require('node:fs').realpathSync(process.argv[1])===require('node:url').fileURLToPath(import.meta.url)){
 const mod=createModule();runtime.listen(mod.server);for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>mod.stop());
}
