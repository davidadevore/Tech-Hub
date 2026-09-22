import http from 'node:http';import https from 'node:https';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import dns from 'node:dns/promises';import {fileURLToPath} from 'node:url';import snmp from 'net-snmp';
const root=path.dirname(fileURLToPath(import.meta.url)),dataRoot=(process.env.TECH_HUB_DATA_DIR||process.env.NETGEAR_DISCOVERY_DATA_DIR)?path.resolve(process.env.TECH_HUB_DATA_DIR||process.env.NETGEAR_DISCOVERY_DATA_DIR):root;fs.mkdirSync(dataRoot,{recursive:true});
const envPath=path.join(dataRoot,'.env'),cachePath=path.join(dataRoot,'discovery-cache.json'),schemePath=path.join(dataRoot,'color-scheme.json');
if(fs.existsSync(envPath))process.loadEnvFile(envPath);
const managed=process.env.TECH_HUB_MANAGED==='1';
const defaults={subnet:'10.1.0.0/24',sourceAddress:'',username:'dashboard',authProtocol:'sha512',authKey:'',privProtocol:'aes',privKey:'',webUsername:'admin',webPassword:'',port:8787,bindAddress:'0.0.0.0',pollSeconds:30};
const defaultProfiles=[
 [1,'Default','#111827'],[2,'PDMonitor','#1687ff'],[10,'ShowInternet','#ffe2ae'],[11,'11_DantePrimary','#ff2b2b'],[12,'12_Dante Secondary','#ffd900'],[13,'13_AudioControl','#ff00cc'],[14,'AUD_14','#eaff00'],[15,'Waves','#7700e8'],[16,'Riedel','#ff271e'],[17,'17_Riedel2','#ff2a28'],[18,'VOIPRemotes','#f4b4df'],[19,'19_AudKVM','#e83ee8'],[21,'Video_21','#1e9bff'],[22,'22_D3Net - Data','#b9fff5'],[26,'26_LX Main','#ff9518'],[27,'27_LX_2nd','#f6d4ff'],[28,'28_Banners','#ff2424'],[29,'29_Showcase 2','#f000d8'],[31,'31_Dante Guest P','#ff2525'],[32,'32_Dante Guest Sec','#caff00'],[33,'Guest 3','#ef8bdc'],[35,'Guest5','#ef51d6'],[41,'Shure Profile','#e6ff00'],[42,'Shure Profile Audio Dante','#0879ee'],[43,'43_Dante Sec','#ffd8cc'],[99,'Remote Internet','#fff3a5'],[101,'Shop Internet','#7f8cff'],[102,'Shop - Cameras','#8886ee'],[103,'Shop-Guest','#fff5a3'],[3001,'3001 - LX','#111827'],[3002,'3002 - LX','#7000ff'],[3005,'3005 LX','#f000dd'],[3007,'3007 - LX','#eb63d7'],[3024,'3024','#b600df']
].map(([id,name,color])=>({id:Number(id),name:String(name),color:String(color)}));
const defaultColorScheme=()=>({sourceIp:'default',sourceName:'Current NETGEAR AV setup',updatedAt:'2026-09-01T15:00:00.000Z',profiles:defaultProfiles});
let config={...defaults,subnet:process.env.SNMP_SUBNET||defaults.subnet,sourceAddress:process.env.SNMP_SOURCE_ADDRESS||'',username:process.env.SNMP_USERNAME||defaults.username,authProtocol:(process.env.SNMP_AUTH_PROTOCOL||defaults.authProtocol).toLowerCase(),authKey:process.env.SNMP_AUTH_KEY||'',privProtocol:(process.env.SNMP_PRIV_PROTOCOL||defaults.privProtocol).toLowerCase(),privKey:process.env.SNMP_PRIV_KEY||'',webUsername:process.env.NETGEAR_WEB_USERNAME||defaults.webUsername,webPassword:process.env.NETGEAR_WEB_PASSWORD||'',port:Number(process.env.COLLECTOR_PORT||defaults.port),bindAddress:process.env.SERVER_BIND_ADDRESS||defaults.bindAddress,pollSeconds:Number(process.env.POLL_SECONDS||defaults.pollSeconds)};
if(managed){config.port=Number(process.env.TECH_HUB_BACKEND_PORT);config.bindAddress='127.0.0.1';}
const configured=()=>config.authKey.length>=8&&config.privKey.length>=8;
const authProtocols={sha:snmp.AuthProtocols.sha,sha224:snmp.AuthProtocols.sha224,sha256:snmp.AuthProtocols.sha256,sha384:snmp.AuthProtocols.sha384,sha512:snmp.AuthProtocols.sha512};
const privProtocols={aes:snmp.PrivProtocols.aes,aes128:snmp.PrivProtocols.aes};
const snmpUser=()=>({name:config.username,level:snmp.SecurityLevel.authPriv,authProtocol:authProtocols[config.authProtocol]??snmp.AuthProtocols.sha512,authKey:config.authKey,privProtocol:privProtocols[config.privProtocol]??snmp.PrivProtocols.aes,privKey:config.privKey});
const O={sysDescr:'1.3.6.1.2.1.1.1.0',sysUpTime:'1.3.6.1.2.1.1.3.0',sysName:'1.3.6.1.2.1.1.5.0',ifDescr:'1.3.6.1.2.1.2.2.1.2',ifType:'1.3.6.1.2.1.2.2.1.3',ifOper:'1.3.6.1.2.1.2.2.1.8',inDiscards:'1.3.6.1.2.1.2.2.1.13',inErrors:'1.3.6.1.2.1.2.2.1.14',outDiscards:'1.3.6.1.2.1.2.2.1.19',outErrors:'1.3.6.1.2.1.2.2.1.20',ifName:'1.3.6.1.2.1.31.1.1.1.1',ifHCInOctets:'1.3.6.1.2.1.31.1.1.1.6',ifHCOutOctets:'1.3.6.1.2.1.31.1.1.1.10',ifHighSpeed:'1.3.6.1.2.1.31.1.1.1.15',ifAlias:'1.3.6.1.2.1.31.1.1.1.18',bridgeMap:'1.3.6.1.2.1.17.1.4.1.2',pvid:'1.3.6.1.2.1.17.7.1.4.5.1.1',vlanName:'1.3.6.1.2.1.17.7.1.4.3.1.1',fdbPort:'1.3.6.1.2.1.17.7.1.2.2.1.2',neighborMac:'1.3.6.1.2.1.4.35.1.4',lldpName:'1.0.8802.1.1.2.1.4.1.1.9',lldpPortDesc:'1.0.8802.1.1.2.1.4.1.1.8',lldpMgmt:'1.0.8802.1.1.2.1.4.2.1.3',poeDetection:'1.3.6.1.2.1.105.1.1.1.6',opticalRxLegacy:'1.3.6.1.4.1.4526.10.43.1.16.1.6',opticalRx:'1.3.6.1.4.1.4526.10.43.1.18.1.6'};
let savedState=null;try{savedState=JSON.parse(fs.readFileSync(cachePath,'utf8'))}catch{}
let state=savedState?.subnet===config.subnet&&Array.isArray(savedState.switches)?{...savedState,status:'online',error:null}:{status:configured()?'starting':'setup_required',subnet:config.subnet,lastUpdated:null,vlans:[],switches:[],error:null};let scanning=false;
const switchCache=new Map((state.switches||[]).map(item=>[item.ip,{switchData:item,vlans:(state.vlans||[]).map(({id,name})=>({id,name})),lastSeen:Date.now()}])),cacheTtlMs=5*60*1000;
let colorScheme=defaultColorScheme();try{const saved=JSON.parse(fs.readFileSync(schemePath,'utf8')),complete=Array.isArray(saved.profiles)&&saved.profiles.some(profile=>profile.color)&&saved.profiles.some(profile=>profile.name&&!/^VLAN \d+$/i.test(profile.name));if(complete)colorScheme=saved;else fs.writeFileSync(schemePath,JSON.stringify(colorScheme,null,2),{mode:0o600})}catch{fs.writeFileSync(schemePath,JSON.stringify(colorScheme,null,2),{mode:0o600})}
const value=v=>Buffer.isBuffer(v)?v.toString('utf8').replace(/\0/g,'').trim():v,indexOf=(oid,base)=>Number(oid.slice(base.length+1).split('.').pop());
function session(ip){return snmp.createV3Session(ip,snmpUser(),{port:161,retries:1,timeout:1800,transport:'udp4',sourceAddress:config.sourceAddress||undefined,backwardsGetNexts:true,idBitsSize:32})}
function get(ip,oids){return new Promise((resolve,reject)=>{const s=session(ip);let settled=false;const done=(e,v)=>{if(settled)return;settled=true;try{s.close()}catch{}e?reject(e):resolve(v)};s.on('error',e=>done(e));s.get(oids,(e,v)=>done(e,v))})}
function walk(ip,base){return new Promise((resolve,reject)=>{const s=session(ip),rows=[];let settled=false;const done=e=>{if(settled)return;settled=true;try{s.close()}catch{}e?reject(e):resolve(rows)};s.on('error',e=>done(e));s.subtree(base,20,vbs=>{for(const vb of vbs)if(!snmp.isVarbindError(vb))rows.push(vb)},e=>done(e))})}
function avRequest(protocol,ip,pathname,{method='GET',headers={},body,timeout=8000}={}){return new Promise((resolve,reject)=>{const payload=body===undefined?null:JSON.stringify(body),client=protocol==='https'?https:http,request=client.request({protocol:`${protocol}:`,hostname:ip,port:protocol==='https'?443:80,path:pathname,method,rejectUnauthorized:false,headers:{Accept:'application/json',...(payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...headers}},response=>{let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>{let data={};try{data=text?JSON.parse(text):{}}catch{}resolve({ok:response.statusCode>=200&&response.statusCode<300,status:response.statusCode,data})})});request.setTimeout(timeout,()=>request.destroy(new Error('AV interface request timed out')));request.on('error',reject);if(payload)request.write(payload);request.end()})}
async function avProfiles(ip,username,password){
 if(!username?.trim()||!password)throw new Error('AV interface username and password are required');
 let login=null,protocol=null,lastLoginError=null;for(const candidate of ['https','http']){try{const response=await avRequest(candidate,ip,'/api/v1/login',{method:'POST',body:{user:{name:username.trim(),password}}});if(response.ok){login=response;protocol=candidate;break}lastLoginError=`HTTP ${response.status}`}catch(e){lastLoginError=e.message}}
 if(!login)throw new Error(`AV login failed (${lastLoginError||'switch unavailable'})`);
 const loginData=login.data,session=loginData?.user?.session;
 if(loginData?.resp?.respCode!==0||!session)throw new Error(`AV login failed (code ${loginData?.resp?.respCode??'unknown'})`);
 try{
  const endpoints=['/api/v1/profile/list','/api/v1/profile/list_ex'],attempts=[];
  for(const endpoint of endpoints){
   const response=await avRequest(protocol,ip,endpoint,{headers:{Session:session}});
   if(response.status===404){attempts.push(`${endpoint} (404)`);continue}
   if(!response.ok)throw new Error(`AV profile API returned HTTP ${response.status} at ${endpoint}`);
   const data=response.data;
   if(data?.resp?.respCode!==0)throw new Error(`AV profile API failed (code ${data?.resp?.respCode??'unknown'})`);
   const groups=Array.isArray(data.profileList)?data.profileList:[];
   const profiles=groups.flatMap(group=>{if(!group)return[];if(!Array.isArray(group.vlans))return[group];const {vlans,...profile}=group;return vlans.map(vlan=>({...profile,...vlan}))});
   if(!profiles.length)throw new Error(`The switch returned no configured AV profiles from ${endpoint}`);
   return {profiles,endpoint};
  }
  throw new Error(`This firmware did not expose a supported AV profile route: ${attempts.join(', ')}`);
 }finally{avRequest(protocol,ip,'/api/v1/logout',{headers:{Session:session},timeout:2500}).catch(()=>{})}
}
function hosts(cidr){const [raw,bitsText]=cidr.split('/'),bits=Number(bitsText);if(bits<16||bits>30)throw new Error('Subnet must be between /16 and /30');const parts=raw.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))throw new Error('Enter a valid IPv4 subnet');const n=((parts[0]<<24)|(parts[1]<<16)|(parts[2]<<8)|parts[3])>>>0,mask=(0xffffffff<<(32-bits))>>>0,network=n&mask,size=2**(32-bits),out=[];for(let i=1;i<size-1;i++){const x=(network+i)>>>0;out.push(`${x>>>24}.${(x>>>16)&255}.${(x>>>8)&255}.${x&255}`)}return out}
async function discover(ip){try{const v=await get(ip,[O.sysDescr,O.sysName,O.sysUpTime]);const descr=String(value(v[0].value)||'');if(!/netgear|m4[0-9]{3}/i.test(descr))return null;return {ip,descr,name:String(value(v[1].value)||ip),ticks:Number(v[2].value||0)}}catch{return null}}
async function pool(items,limit,work){const results=[];let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const result=await work(items[next++]);if(result)results.push(result)}}));return results}
const table=rows=>Object.fromEntries(rows.map(r=>[indexOf(r.oid,r.base),value(r.value)]));
const rawTable=rows=>Object.fromEntries(rows.map(r=>[indexOf(r.oid,r.base),r.value]));
async function inspect(sw){
 const bases=[O.ifDescr,O.ifType,O.ifOper,O.inDiscards,O.inErrors,O.outDiscards,O.outErrors,O.ifName,O.ifHCInOctets,O.ifHCOutOctets,O.ifHighSpeed,O.ifAlias,O.bridgeMap,O.pvid,O.vlanName,O.fdbPort,O.neighborMac,O.lldpName,O.lldpPortDesc,O.lldpMgmt,O.poeDetection,O.opticalRxLegacy,O.opticalRx];
 const result=[];for(let i=0;i<bases.length;i+=4)result.push(...await Promise.all(bases.slice(i,i+4).map(async base=>(await walk(sw.ip,base)).map(r=>({...r,base})))));
 const tables=result.slice(0,15).map(table);tables[8]=rawTable(result[8]);tables[9]=rawTable(result[9]);
 const [descr,type,oper,inDrop,inErr,outDrop,outErr,names,inOctets,outOctets,speeds,aliases,bridge,pvids,vlanNames]=tables;
 const [fdbRows,neighborRows,lldpRows,lldpDescRows,lldpMgmtRows,poeRows,opticalLegacyRows,opticalRows]=result.slice(15),ifToPvid={},bridgeToIf={},ifToBridge={};
 for(const [bridgePort,ifIndex] of Object.entries(bridge)){bridgeToIf[Number(bridgePort)]=Number(ifIndex);ifToBridge[Number(ifIndex)]=Number(bridgePort);ifToPvid[Number(ifIndex)]=Number(pvids[Number(bridgePort)]||1)}
 const normalizeMac=bytes=>bytes.map(n=>Number(n).toString(16).padStart(2,'0')).join(':');
 const macToIp={};
 for(const row of neighborRows){const suffix=row.oid.slice(O.neighborMac.length+1).split('.').map(Number),length=suffix[2],ip=suffix.slice(3,3+length).join('.'),mac=Buffer.isBuffer(row.value)?normalizeMac([...row.value]):'';if(length===4&&mac)macToIp[mac]=ip}
 const macsByIf={};
 for(const row of fdbRows){const suffix=row.oid.slice(O.fdbPort.length+1).split('.').map(Number),mac=normalizeMac(suffix.slice(-6)),ifIndex=bridgeToIf[Number(row.value)];if(ifIndex)(macsByIf[ifIndex]??=[]).push({mac,ip:macToIp[mac]})}
 const lldpByPort={},lldpRemotePortByPort={},lldpIpByPort={};
 for(const row of lldpRows){const suffix=row.oid.slice(O.lldpName.length+1).split('.').map(Number),localPort=suffix.at(-2),name=String(value(row.value)||'').trim();if(localPort&&name)lldpByPort[localPort]=name}
 for(const row of lldpDescRows){const suffix=row.oid.slice(O.lldpPortDesc.length+1).split('.').map(Number),localPort=suffix.at(-2),name=String(value(row.value)||'').trim();if(localPort&&name)lldpRemotePortByPort[localPort]=name}
 for(const row of lldpMgmtRows){const suffix=row.oid.slice(O.lldpMgmt.length+1).split('.').map(Number),localPort=suffix[1],length=suffix[4],ip=suffix.slice(5,5+length).join('.');if(localPort&&length===4)lldpIpByPort[localPort]=ip}
 const poeByPort={};
 for(const row of poeRows){const port=Number(row.oid.split('.').at(-1));poeByPort[port]=Number(row.value)}
 const opticalByPort={};
 for(const row of opticalLegacyRows){const port=Number(row.oid.split('.').at(-1)),raw=value(row.value),text=String(raw??'').trim();if(port&&text)opticalByPort[port]=/dbm/i.test(text)?text:Number.isFinite(Number(raw))?`${(Number(raw)/100).toFixed(2)} dBm`:text}
 for(const row of opticalRows){const port=Number(row.oid.split('.').at(-1)),raw=value(row.value),text=String(raw??'').trim();if(port&&text)opticalByPort[port]=/dbm/i.test(text)?text:Number.isFinite(Number(raw))?`${(Number(raw)/1000).toFixed(3)} dBm`:text}
 const physical=Object.keys(names).map(Number).filter(i=>{const name=String(names[i]||'').trim(),description=String(descr[i]||'').trim(),label=`${name} ${description}`;return [6,117].includes(Number(type[i]))&&!/vlan|loopback|lag|port-channel|cpu|stack/i.test(label)&&(/^\d+(?:\/\d+){0,2}$/.test(name)||/^(?:g|xg|ge|xe)\d+(?:\/\d+){0,2}$/i.test(name)||/(?:ethernet|gigabit|physical)\s*(?:port)?\s*\d+/i.test(description))}).sort((a,b)=>a-b);
 const sampledAt=Date.now(),previous=switchCache.get(sw.ip)?.switchData?.ports||[],counter=item=>{if(typeof item==='bigint')return Number(item);if(Buffer.isBuffer(item)){let total=0;for(const byte of item)total=total*256+byte;return total}return Number(item||0)};
 const switchData={id:sw.ip.replaceAll('.','-'),name:sw.name,model:(sw.descr.match(/M4\d{3}[-\w+]*/i)||['NETGEAR AV'])[0],ip:sw.ip,location:'Discovered switch',uptime:formatUptime(sw.ticks),ports:physical.map((ifIndex,pos)=>{const label=String(names[ifIndex]||descr[ifIndex]),number=Number((label.match(/\d+(?!.*\d)/)||[pos+1])[0]),speed=Number(speeds[ifIndex]||0),learned=[...new Map((macsByIf[ifIndex]||[]).map(item=>[item.mac,item])).values()],endpoint=learned.length===1?learned[0]:null,description=String(aliases[ifIndex]||'').trim()||undefined,device=lldpByPort[ifIndex]||lldpByPort[number]||(learned.length===1?'Learned endpoint':learned.length>1?`${learned.length} learned devices`:undefined),bytesIn=counter(inOctets[ifIndex]),bytesOut=counter(outOctets[ifIndex]),prior=previous.find(port=>port.number===number),elapsed=prior?.sampledAt?(sampledAt-prior.sampledAt)/1000:0,hasPrior=prior?.bytesIn!=null&&prior?.bytesOut!=null,delta=hasPrior&&elapsed>0?Math.max(0,bytesIn-Number(prior.bytesIn))+Math.max(0,bytesOut-Number(prior.bytesOut)):0;return {number,bridgePort:ifToBridge[ifIndex],interface:label,description,status:Number(oper[ifIndex])===1?'up':'down',speed:speed?`${speed>=1000?speed/1000:speed}${speed>=1000?'G':'M'}`:undefined,vlan:ifToPvid[ifIndex]||1,device,neighborPort:lldpRemotePortByPort[ifIndex]||lldpRemotePortByPort[number],ip:endpoint?.ip||lldpIpByPort[ifIndex]||lldpIpByPort[number],mac:endpoint?.mac,learnedMacs:learned.map(item=>item.mac),drops:Number(inDrop[ifIndex]||0)+Number(outDrop[ifIndex]||0),errors:Number(inErr[ifIndex]||0)+Number(outErr[ifIndex]||0),poe:poeByPort[number]===3?'Delivering power':poeByPort[number]===2?'Not delivering':undefined,optical:opticalByPort[ifIndex]||opticalByPort[number],media:/49|50|51|52$|sfp|fiber|10g/i.test(label)||number>48?'sfp':'copper',bytesIn,bytesOut,sampledAt,usageMbps:hasPrior&&elapsed>0?delta*8/elapsed/1e6:undefined}})};
 return {switchData,macToIp,vlans:Object.entries(vlanNames).map(([id,name])=>({id:Number(id),name:String(name)||`VLAN ${id}`})).sort((a,b)=>a.id-b.id)}
}
const genericVlanName=(name,id)=>!String(name||'').trim()||String(name).trim().toLowerCase()===`vlan ${id}`.toLowerCase();
const nestedEntries=value=>value&&typeof value==='object'?Object.entries(value).flatMap(([key,item])=>[[key,item],...(item&&typeof item==='object'?nestedEntries(item):[])]):[];
const fieldValue=(profile,exact,pattern)=>{for(const key of exact)if(profile?.[key]!==undefined&&profile[key]!==null&&profile[key]!=='')return profile[key];const match=nestedEntries(profile).find(([key,value])=>pattern.test(key)&&value!==undefined&&value!==null&&value!==''&&typeof value!=='object');return match?.[1]};
const cssColor=value=>{if(value===undefined||value===null||value==='')return undefined;if(typeof value==='object'){const nested=value.hex??value.value??value.rgb??value.color??value.colour;if(nested!==undefined)return cssColor(nested);const {r,g,b}=value;if([r,g,b].every(channel=>Number.isFinite(Number(channel))))return `rgb(${Number(r)} ${Number(g)} ${Number(b)})`;return undefined}if(typeof value==='number'){if(value<256)return undefined;return `#${Math.min(value,0xffffff).toString(16).padStart(6,'0')}`}const color=String(value).trim();if(/^#?[0-9a-f]{6,8}$/i.test(color))return color.startsWith('#')?color:`#${color}`;if(/^(?:rgb|hsl)a?\(|^[a-z]+$/i.test(color))return color;return undefined};
function normalizeAvProfile(profile){
 const id=Number(fieldValue(profile,['vlanId','vlan_id','vid','vlan','id'],/(?:^|_)(?:vlan_?)?id$/i));
 const rawName=fieldValue(profile,['profileName','profile_name','vlanName','vlan_name','networkName','network_name','displayName','display_name','name','label'],/(?:profile|vlan|network|display).*name|(?:^|_)label$/i);
 const rawColor=fieldValue(profile,['profileColor','profile_color','vlanColor','vlan_color','networkColor','network_color','color','colour','hexColor','hex_color','colorCode','color_code'],/(?:color|colour)/i);
 return {id,name:String(rawName||`VLAN ${id}`),color:cssColor(rawColor)};
}
const applyColorScheme=vlans=>{const byId=new Map(colorScheme.profiles.map(profile=>[Number(profile.id),profile]));return vlans.map(vlan=>{const profile=byId.get(Number(vlan.id)),name=profile&&!genericVlanName(profile.name,profile.id)?String(profile.name):vlan.name,color=cssColor(profile?.color);return {...vlan,name:String(name||`VLAN ${vlan.id}`),color}})};
function combinedVlans(){const byId=new Map;for(const item of switchCache.values())for(const vlan of item.vlans)if(!byId.has(vlan.id))byId.set(vlan.id,{id:Number(vlan.id),name:String(vlan.name)});return applyColorScheme([...byId.values()].sort((a,b)=>a.id-b.id))}
function formatUptime(ticks){const sec=Math.floor(ticks/100),d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600);return `${d}d ${String(h).padStart(2,'0')}h`}
async function scan(){
 if(scanning||!configured())return;scanning=true;
 try{
  state={...state,status:'scanning',subnet:config.subnet,error:null};
  const found=await pool(hosts(config.subnet),24,discover),now=Date.now();
  for(const sw of found){
   try{const inspected=await inspect(sw);switchCache.set(sw.ip,{...inspected,lastSeen:now})}
   catch(e){console.warn(`Could not read interfaces from ${sw.ip}: ${e.message}; keeping the last successful reading`)}
  }
  for(const [ip,cached] of switchCache)if(now-cached.lastSeen>cacheTtlMs)switchCache.delete(ip);
  const cached=[...switchCache.values()],globalMacToIp=Object.assign({},...cached.map(item=>item.macToIp||{}));
  for(const item of cached)for(const port of item.switchData.ports)if(!port.ip&&port.learnedMacs?.length===1)port.ip=globalMacToIp[port.learnedMacs[0]];
  const ips=[...new Set(cached.flatMap(item=>item.switchData.ports.map(port=>port.ip).filter(Boolean)))],resolved=await pool(ips,12,async ip=>{try{const names=await Promise.race([dns.reverse(ip),new Promise((_,reject)=>setTimeout(()=>reject(new Error('DNS timeout')),700))]);return names?.[0]?{ip,name:names[0].replace(/\.$/,'')}:null}catch{return null}}),namesByIp=Object.fromEntries(resolved.map(item=>[item.ip,item.name]));
  for(const item of cached)for(const port of item.switchData.ports){if(port.ip&&namesByIp[port.ip]&&(!port.device||/^(?:Learned endpoint|Known IP endpoint)$/.test(port.device)))port.device=namesByIp[port.ip];else if(port.learnedMacs?.length===1&&(!port.device||port.device==='Learned endpoint'))port.device=`MAC ${port.learnedMacs[0]}`}
  const switches=cached.map(item=>item.switchData).sort((a,b)=>a.ip.localeCompare(b.ip,undefined,{numeric:true}));
  state={status:'online',subnet:config.subnet,lastUpdated:new Date().toISOString(),vlans:combinedVlans(),switches,error:null};
  fs.writeFileSync(cachePath,JSON.stringify(state),{mode:0o600});
  console.log(`SNMP scan complete: ${switches.length} NETGEAR switch(es) available (${found.length} responded to discovery)`);
 }catch(e){state={...state,status:'error',error:e.message,lastUpdated:new Date().toISOString()}}
 finally{scanning=false}
}
const local=req=>{if(managed)return req.headers['x-techhub-local-client']==='1';const address=(req.socket.remoteAddress||'').replace(/^::ffff:/,'');return ['127.0.0.1','::1',...interfaces().map(item=>item.address)].includes(address)};
const send=(res,status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});res.end(type==='application/json'?JSON.stringify(data):data)};
const readBody=req=>new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>65536)reject(new Error('Request too large'))});req.on('end',()=>{try{resolve(JSON.parse(body))}catch{reject(new Error('Invalid settings'))}})});
function publicConfig(){return {managed,subnet:config.subnet,sourceAddress:config.sourceAddress,username:config.username,webUsername:config.webUsername,authProtocol:config.authProtocol,privProtocol:config.privProtocol,port:config.port,bindAddress:config.bindAddress,pollSeconds:config.pollSeconds,hasAuthKey:!!config.authKey,hasPrivKey:!!config.privKey,hasWebPassword:!!config.webPassword}}
function interfaces(){return Object.entries(os.networkInterfaces()).flatMap(([name,addresses])=>(addresses||[]).filter(a=>(a.family==='IPv4'||a.family===4)&&!a.internal).map(a=>({name,address:a.address,netmask:a.netmask,cidr:a.cidr||`${a.address}/24`,mac:a.mac}))).sort((a,b)=>a.name.localeCompare(b.name)||a.address.localeCompare(b.address,undefined,{numeric:true}))}
function dashboardAddress(){if(!['0.0.0.0','127.0.0.1','::','::1'].includes(config.bindAddress))return config.bindAddress;const available=interfaces(),managementPrefix=config.subnet.split('/')[0].split('.').slice(0,3).join('.');return available.find(item=>!item.address.startsWith(`${managementPrefix}.`))?.address||available[0]?.address||'localhost'}
function saveConfig(next){hosts(next.subnet);if(!next.username?.trim())throw new Error('SNMPv3 username is required');const authKey=next.authKey?.trim()||config.authKey,privKey=next.privKey?.trim()||config.privKey,webPassword=next.webPassword||config.webPassword;if(authKey.length<8||privKey.length<8)throw new Error('Both SNMPv3 keys must be at least 8 characters');const oldBind=config.bindAddress;config={...config,subnet:next.subnet.trim(),sourceAddress:(next.sourceAddress||'').trim(),username:next.username.trim(),authProtocol:'sha512',authKey,privProtocol:'aes',privKey,webUsername:(next.webUsername||'admin').trim(),webPassword,bindAddress:managed?'127.0.0.1':(next.bindAddress||'0.0.0.0').trim(),pollSeconds:Math.max(10,Number(next.pollSeconds)||30)};const lines=[`SNMP_SUBNET=${config.subnet}`,`SNMP_SOURCE_ADDRESS=${config.sourceAddress}`,`SNMP_USERNAME=${config.username}`,`SNMP_AUTH_PROTOCOL=${config.authProtocol}`,`SNMP_AUTH_KEY=${config.authKey}`,`SNMP_PRIV_PROTOCOL=${config.privProtocol}`,`SNMP_PRIV_KEY=${config.privKey}`,`NETGEAR_WEB_USERNAME=${config.webUsername}`,`NETGEAR_WEB_PASSWORD=${config.webPassword}`,`COLLECTOR_PORT=${config.port}`,`SERVER_BIND_ADDRESS=${config.bindAddress}`,`POLL_SECONDS=${config.pollSeconds}`];fs.writeFileSync(envPath,lines.join('\n')+'\n',{mode:0o600});state={...state,status:'starting',subnet:config.subnet,error:null};scan();return oldBind!==config.bindAddress}
const handleRequest=async(req,res)=>{
 if(req.method==='OPTIONS')return send(res,204,{});
 const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
 if(url.pathname==='/api/switches')return send(res,200,{...state,dashboardAddress:dashboardAddress(),dashboardPort:Number(process.env.TECH_HUB_PUBLIC_PORT||3000)});
 if(url.pathname==='/api/scan'&&req.method==='POST'){scan();return send(res,202,{status:configured()?'scanning':'setup_required'})}
 if(url.pathname==='/api/health')return send(res,200,{ok:true,status:state.status,subnet:config.subnet});
 if(url.pathname==='/api/interfaces'){if(!local(req))return send(res,403,{error:'Interface discovery is available only on the Tech Hub computer.'});return send(res,200,{interfaces:interfaces()})}
 if(url.pathname==='/api/color-scheme'){
  if(req.method==='GET')return send(res,200,colorScheme);
  if(!local(req))return send(res,403,{error:'Color schemes can be changed only on the Tech Hub computer.'});
  if(req.method==='POST'){
   try{const body=await readBody(req),profiles=(body.profiles||[]).map(profile=>({id:Number(profile.id),name:String(profile.name||`VLAN ${profile.id}`),color:profile.color?String(profile.color):undefined})).filter(profile=>Number.isInteger(profile.id)&&profile.id>0&&profile.id<4095);if(!profiles.length)throw new Error('The pulled scheme does not contain any VLAN profiles');colorScheme={sourceIp:String(body.sourceIp||''),sourceName:String(body.sourceName||body.sourceIp||''),updatedAt:new Date().toISOString(),profiles};fs.writeFileSync(schemePath,JSON.stringify(colorScheme,null,2),{mode:0o600});state={...state,vlans:combinedVlans()};fs.writeFileSync(cachePath,JSON.stringify(state),{mode:0o600});return send(res,200,colorScheme)}catch(e){return send(res,400,{error:e.message})}
  }
 }
 if(url.pathname==='/api/color-scheme/pull'&&req.method==='POST'){
  if(!local(req))return send(res,403,{error:'AV interface login is available only on the Tech Hub computer.'});
  try{const body=await readBody(req),target=state.switches.find(item=>item.ip===body.switchIp);if(!target)throw new Error('Select a currently discovered switch');const pulled=await avProfiles(target.ip,String(body.username||'admin'),String(body.password||'')),profiles=[...new Map(pulled.profiles.map(normalizeAvProfile).filter(profile=>Number.isInteger(profile.id)&&profile.id>0&&profile.id<4095).map(profile=>[profile.id,profile])).values()];if(!profiles.length)throw new Error('No AV VLAN profiles were returned by this switch');return send(res,200,{sourceIp:target.ip,sourceName:target.name,endpoint:pulled.endpoint,profiles})}catch(e){return send(res,400,{error:e.message})}
 }
 if(url.pathname==='/setup'||url.pathname==='/setup.css'||url.pathname==='/setup.js'){
  if(!local(req))return send(res,403,'Settings are available only on the Tech Hub computer.','text/plain');
  const file=url.pathname==='/setup'?'setup.html':url.pathname.slice(1);
  return send(res,200,fs.readFileSync(path.join(root,file)),file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');
 }
 if(url.pathname==='/api/config'){
  if(!local(req))return send(res,403,{error:'Settings are available only on the Tech Hub computer.'});
  if(req.method==='GET')return send(res,200,publicConfig());
  if(req.method==='POST'){
   try{const restartRequired=saveConfig(await readBody(req));return send(res,200,{ok:true,restartRequired,status:'Scanning network…'})}
   catch(e){return send(res,400,{error:e.message})}
  }
 }
 if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
  try {
   const publicRoot=path.resolve(root,'../out'),file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(publicRoot+path.sep))return send(res,403,{error:'Forbidden'});
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain'};
   return send(res,200,fs.readFileSync(file),types[path.extname(file)]||'application/octet-stream');
  }catch{}
 }
 return send(res,404,{error:'Not found'});
};
const listen=address=>http.createServer(handleRequest).listen(config.port,address,()=>console.log(`NETGEAR AV collector listening on ${address}:${config.port}`));
const availableAddresses=new Set(interfaces().map(item=>item.address));
if(!['0.0.0.0','127.0.0.1','::','::1'].includes(config.bindAddress)&&!availableAddresses.has(config.bindAddress)){
 console.warn(`Configured bind address ${config.bindAddress} is unavailable; listening on all interfaces instead`);
 config.bindAddress='0.0.0.0';
}
if(config.sourceAddress&&!availableAddresses.has(config.sourceAddress)){
 console.warn(`Configured SNMP source address ${config.sourceAddress} is unavailable; using automatic routing instead`);
 config.sourceAddress='';
}
listen(config.bindAddress);
if(!['0.0.0.0','127.0.0.1'].includes(config.bindAddress))listen('127.0.0.1');
if(!managed&&!['::','::1'].includes(config.bindAddress))listen('::1');
if(configured())scan();else console.log(`Complete setup at http://localhost:${config.port}/setup`);
setInterval(scan,Math.max(10,config.pollSeconds)*1000);
