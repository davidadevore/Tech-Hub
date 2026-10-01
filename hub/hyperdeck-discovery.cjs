'use strict';
// Finds HyperDecks by opening TCP 9993 and reading the greeting block the deck sends on connect.
// No command is ever sent: a HyperDeck only records when a client asks it to.
const net=require('node:net'),os=require('node:os');

const toNumber=ip=>ip.split('.').reduce((n,p)=>n*256+Number(p),0);
const toIp=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
function allowed(n){
 const a=n>>>24,b=(n>>>16)&255;
 return a===10||a===127||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===169&&b===254);
}
function targets(input){
 const m=/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(String(input??'').trim());
 if(!m||m[1].split('.').some(p=>Number(p)>255))throw Error('Enter one IP address, or a /24 or /23 range such as 10.15.10.0/23.');
 const bits=m[2]===undefined?32:Number(m[2]);
 if(![23,24,32].includes(bits))throw Error('Scan one address, a /24 or a /23.');
 const n=toNumber(m[1]);
 if(!allowed(n))throw Error('Only private network addresses can be scanned.');
 if(bits===32)return [toIp(n)];
 const size=2**(32-bits),base=n-(n%size),out=[];
 for(let i=1;i<size-1;i++)out.push(toIp(base+i));
 return out;
}
function suggestions(interfaces=os.networkInterfaces()){
 const out=[];
 for(const addr of Object.values(interfaces).flat()){
  if(!addr||addr.internal||!(addr.family==='IPv4'||addr.family===4)||!allowed(toNumber(addr.address)))continue;
  const bits=Math.max(23,Math.min(24,Number(String(addr.cidr||'').split('/')[1])||24)),size=2**(32-bits),n=toNumber(addr.address);
  out.push(`${toIp(n-(n%size))}/${bits}`);
 }
 return [...new Set(out)];
}
function probe(host,{port=9993,timeout=1500}={}){
 return new Promise(resolve=>{
  let text='',settled=false;
  const socket=net.connect({host,port});
  const done=result=>{if(settled)return;settled=true;socket.destroy();resolve(result);};
  socket.setTimeout(timeout,()=>done(null));
  socket.on('error',()=>done(null));
  socket.on('close',()=>done(null));
  socket.on('data',chunk=>{
   text+=chunk.toString('latin1').replace(/\r/g,'');
   if(text.length>4096)return done(null);
   const first=text.split('\n')[0];
   if(!text.includes('\n'))return;
   if(/^120 /.test(first))return done({host,port,busy:true});
   if(!/^500 connection info:/i.test(first))return done(null);
   const end=text.indexOf('\n\n');
   if(end<0)return;
   const fields={};
   for(const line of text.slice(0,end).split('\n').slice(1)){const i=line.indexOf(': ');if(i>0)fields[line.slice(0,i).trim().toLowerCase()]=line.slice(i+2).trim();}
   done({host,port,model:fields.model||null,protocolVersion:fields['protocol version']||null,uniqueId:fields['unique id']||null,busy:false});
  });
 });
}
async function scan(target,{skip=[],port=9993,timeout=1500,concurrency=64}={}){
 const hosts=targets(target),skipSet=new Set(skip),queue=hosts.filter(h=>!skipSet.has(h)),found=[];
 let next=0;
 await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{
  while(next<queue.length){const result=await probe(queue[next++],{port,timeout});if(result)found.push(result);}
 }));
 found.sort((a,b)=>toNumber(a.host)-toNumber(b.host));
 return {scanned:queue.length,found,skipped:hosts.filter(h=>skipSet.has(h))};
}
module.exports={targets,suggestions,probe,scan};
