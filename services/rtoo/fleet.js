import { TCPConnection, RemoteDevice } from 'aes70';
import { setTimeout as delay } from 'node:timers/promises';
import { watchAmp } from './watch.js';
export const errorFlags=['generalError','deviceError','ampError','smpsError'];
export function createFleet({connect=options=>TCPConnection.connect(options),deviceFactory=c=>new RemoteDevice(c),watch=watchAmp,retryMs=5000,timeoutMs=15000}={}){
 const states=new Map(),workers=new Map();let stopped=false,slots=0;
 function remove(serial){workers.get(serial)?.abort();workers.delete(serial);states.delete(serial);}
 function add(info){
  if(stopped)return;
  const old=states.get(info.serial);
  if(old&&old.host===info.host&&old.port===info.port){Object.assign(old,{model:info.model,deviceName:info.deviceName});return;}
  if(old)remove(info.serial);
  if(states.size>=128)return;
  // Manual and discovery entries for the same endpoint should not connect twice.
  if([...states.values()].some(a=>a.host===info.host&&a.port===info.port))return;
  const amp={...info,connected:false,status:{},channels:[],suppressedFlags:[],error:null};states.set(info.serial,amp);
  const controller=new AbortController();workers.set(info.serial,controller);
  run(info.serial,amp,controller).catch(e=>{if(!controller.signal.aborted)amp.error=e.message;});
 }
 async function run(serial,amp,controller){
  while(!controller.signal.aborted){
   let connection,unwatch,slot=false,timer;
   const cancel=()=>{try{connection?.close();}catch{}};
   controller.signal.addEventListener('abort',cancel);
   try{
    while(slots>=4)await delay(50,null,{signal:controller.signal});
    controller.signal.throwIfAborted();slots++;slot=true;
    connection=await connect({host:amp.host,port:amp.port,connectSignal:AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs)])});
    if(controller.signal.aborted){cancel();return;}
    let closeResolve;const closed=new Promise(r=>{closeResolve=r;});
    connection.on('close',()=>closeResolve());connection.on('error',e=>{amp.error=e?.message||'Connection error';cancel();});
    timer=setTimeout(cancel,timeoutMs);
    const device=deviceFactory(connection);device.set_keepalive_interval(5);
    const roles=await Promise.race([device.get_role_map(),closed.then(()=>{throw Error('Connection closed during device discovery');})]);
    clearTimeout(timer);slots--;slot=false;
    const channelCount=[...roles.keys()].filter(k=>/^ChStatus\/ChStatus_Isp\d+$/.test(k)).length;
    if(channelCount<1||channelCount>64)throw Error('No compatible amplifier channels found');
    amp.status={};amp.channels=Array.from({length:channelCount},()=>({}));amp.error=null; amp.connected=true;
    unwatch=watch({roles,channelCount,amp,serial,states,controller,broadcast(){}});
    await closed;
   }catch(e){if(!controller.signal.aborted)amp.error=e?.message||'Unable to connect';}
   finally{clearTimeout(timer);if(slot)slots--;unwatch?.();cancel();controller.signal.removeEventListener('abort',cancel);amp.connected=false; amp.channels=[];amp.status={};}
   if(!controller.signal.aborted)await delay(retryMs,null,{signal:controller.signal}).catch(()=>{});
  }
 }
 return {add,remove,snapshot:()=>Object.fromEntries(states),suppress(serial,flag,suppressed){const amp=states.get(serial);if(!amp||!errorFlags.includes(flag))return false;const flags=new Set(amp.suppressedFlags);suppressed?flags.add(flag):flags.delete(flag);amp.suppressedFlags=[...flags];return true;},stop(){stopped=true;for(const id of [...states.keys()])remove(id);}};
}
