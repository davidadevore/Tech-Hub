import { Bonjour } from 'bonjour-service';
import net from 'node:net';
// Portable mDNS; no platform executable or native add-on. Only d&b TXT records qualify.
export function parseService(service){
 const txt=service.txt||{},serial=String(txt.db_serialnumber||'').slice(0,120);
 const host=(service.addresses||[]).find(a=>net.isIPv4(a));
 if(!serial||!host||!Number.isInteger(service.port)||service.port<1||service.port>65535)return null;
 return {serial,host,port:service.port,deviceName:String(txt.db_devicename||service.name||serial).slice(0,120),model:String(txt.db_firmwarevers||'?').trim().split(/\s+/)[0].slice(0,40)};
}
export function startDiscovery(onDevice,onError,Factory=Bonjour){
 const bonjour=new Factory({},onError);
 bonjour.server?.mdns?.on('error',onError);
 bonjour.server?.mdns?.on('warning',onError);
 const browser=bonjour.find({type:'oca',protocol:'tcp'},service=>{const device=parseService(service);if(device)onDevice(device);});
 const refresh=setInterval(()=>browser.update(),20000);refresh.unref();
 return ()=>{clearInterval(refresh);browser.stop();bonjour.destroy();};
}
