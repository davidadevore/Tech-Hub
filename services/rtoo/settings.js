import net from 'node:net';
export const defaults={discovery:false,hosts:[]};
export function validateSettings(value){
 if(!value||typeof value.discovery!=='boolean'||!Array.isArray(value.hosts)||value.hosts.length>128)throw Error('Choose discovery and up to 128 amplifier addresses.');
 const hosts=value.hosts.map(entry=>{
  if(typeof entry!=='string')throw Error('Enter an IP address or hostname, optionally followed by :port.');
  const m=/^(\[[\da-f:]+\]|[a-z\d.-]+)(?::(\d+))?$/i.exec(entry.trim());
  if(!m)throw Error('Invalid amplifier address: '+entry.slice(0,100));
  const host=m[1],port=m[2]?Number(m[2]):30013;
  if(host.length>253||(!net.isIP(host.replace(/^\[|\]$/g,''))&&!/^(?=.{1,253}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(host))||port<1||port>65535)throw Error('Invalid amplifier address or port.');
  return host.toLowerCase()+':'+port;
 });
 return {discovery:value.discovery,hosts:[...new Set(hosts)]};
}
export function endpoint(entry){const i=entry.lastIndexOf(':');return {host:entry.slice(0,i).replace(/^\[|\]$/g,''),port:Number(entry.slice(i+1))};}
