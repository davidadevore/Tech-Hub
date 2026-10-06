'use strict';
function createViewers({now=Date.now,ttl=60000,limit=4096}={}){
 const entries=new Map();
 function prune(){for(const[k,v]of entries)if(now()-v.lastSeen>=ttl)entries.delete(k);}
 return {
  touch(req,service){const id=req.headers['x-techhub-viewer'];if(typeof id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(id))return false;prune();const ip=(req.socket.remoteAddress||'').replace(/^::ffff:/,''),key=JSON.stringify([ip,service,id]);if(!entries.has(key)&&entries.size>=limit)entries.delete(entries.keys().next().value);entries.set(key,{ip,service,lastSeen:now()});return true;},
  list(){prune();const groups=new Map();for(const e of entries.values()){const key=JSON.stringify([e.ip,e.service]),g=groups.get(key)||{ip:e.ip,service:e.service,sessions:0,lastSeen:0};g.sessions++;g.lastSeen=Math.max(g.lastSeen,e.lastSeen);groups.set(key,g);}return [...groups.values()].sort((a,b)=>a.ip.localeCompare(b.ip)||a.service.localeCompare(b.service));},
  remove(service){for(const[k,v]of entries)if(v.service===service)entries.delete(k);}
 };
}
module.exports={createViewers};
