'use strict';
const fs=require('node:fs'),path=require('node:path');
const defaults={
 record:{devices:[],pollIntervalMs:2000,warnFreePercent:20,criticalFreePercent:10,controlEnabled:true,controlLocalOnly:true,confirmStop:true,allowFormat:false},
 ultrix:{title:'Ultrix Panel',router:{host:'',port:2000,matrix:1,extended:'auto',nameChars:'auto',allowRouting:true},mock:{enabled:false},levels:[{name:'Video',short:'V'}],sources:{},destinations:{},defaultProfile:'operator',profiles:{operator:{title:'Operator'},viewer:{title:'Viewer',readOnly:true}}}
};
function validate(id,value){
 if(!Object.hasOwn(defaults,id)||!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid service configuration');
 if(id==='record'){
  if(!Array.isArray(value.devices)||value.devices.length>128)throw Error('Devices must be an array of up to 128 recorders.');
  for(const d of value.devices)if(!['hyperdeck','kipro'].includes(d.type)||typeof d.host!=='string'||!d.host.trim()||/[\s/]/.test(d.host)|| (d.port!==undefined&&(!Number.isInteger(d.port)||d.port<1||d.port>65535)))throw Error('Each recorder needs type hyperdeck or kipro, a host, and a valid optional port.');
  if(!Number.isFinite(value.pollIntervalMs)||value.pollIntervalMs<250)throw Error('Poll interval must be at least 250 ms.');
 }else{
  const r=value.router;
  if(!r||typeof r.host!=='string'||/[\s/]/.test(r.host)||!Number.isInteger(r.port)||r.port<1||r.port>65535)throw Error('Enter a router host and TCP port (leave host empty to stay disconnected).');
  if(!Array.isArray(value.levels)||!value.levels.length||value.levels.length>128)throw Error('Define between 1 and 128 router levels.');
  if(value.mock?.enabled)throw Error('Simulator mode is reserved for tests in the bundled service.');
  if(!value.profiles||!Object.hasOwn(value.profiles,value.defaultProfile))throw Error('The default profile must exist in profiles.');
 }
 return value;
}
function file(dir,id){if(!Object.hasOwn(defaults,id))throw Error('Unknown settings service');return path.join(dir,id,'config.json');}
function read(dir,id){const name=file(dir,id);if(!fs.existsSync(name))write(dir,id,structuredClone(defaults[id]));return JSON.parse(fs.readFileSync(name,'utf8'));}
function write(dir,id,value){validate(id,value);const name=file(dir,id);fs.mkdirSync(path.dirname(name),{recursive:true,mode:0o700});fs.writeFileSync(name+'.tmp',JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(name+'.tmp',name);}
module.exports={defaults,validate,file,read,write};
