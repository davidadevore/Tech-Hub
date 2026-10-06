'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),Zip=require('adm-zip');
const {pack}=require('../sdk/package.cjs');
const resources=path.resolve(process.argv[2]),platform=process.platform+'-'+process.arch,version=require('../package.json').version,output=path.resolve('dist','app-packages-'+platform),stage=fs.mkdtempSync(path.join(os.tmpdir(),'techhub-packages-'));
if(!['darwin-arm64','win32-x64'].includes(platform))throw Error('Unsupported packaging platform');
function copyTree(from,to){if(path.basename(from)==='.env.example')return;const st=fs.statSync(from);if(st.isDirectory()){fs.mkdirSync(to,{recursive:true});for(const name of fs.readdirSync(from))copyTree(path.join(from,name),path.join(to,name));}else{fs.copyFileSync(from,to);fs.chmodSync(to,st.mode&0o777);}}
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});const catalog={schemaVersion:1,apps:[]},exe=process.platform==='win32'?'.exe':'';
const specs=[
 ['dsan','D’san Ready','Limitimer and PerfectCue','native','dsan/dsan-server'+exe,'#ff8a1f',['dsan']],
 ['lux','Lux Link','Lighting network monitoring','node','start.cjs','#c084fc',['lux']],
 ['power','Power Monitor','Power distribution monitoring','native','power-server'+exe,'#4ade80',['power-server'+exe]],
 ['netgear','NETGEAR AV Switchboard','Switch discovery and monitoring','node','netgear/collector/server.mjs','#22d3ee',['netgear']],
 ['record','Record Monitor','HyperDeck and AJA Ki Pro recorders','node','record/server.js','#ef4444',['record']],
 ['ultrix','Router Panel','Ultrix and Videohub routing','node','ultrix/src/main.js','#3b82f6',['ultrix']]
];
try{for(const [id,name,description,runtime,entry,accent,files]of specs){const dir=path.join(stage,id);fs.mkdirSync(dir);for(const file of files)copyTree(path.join(resources,file),path.join(dir,file));
 if(id==='lux'){fs.copyFileSync(path.join(resources,'hub/lux-server.cjs'),path.join(dir,'lux-server.cjs'));fs.writeFileSync(path.join(dir,'start.cjs'),"process.argv[2]=require('node:path').join(__dirname,'lux');require('./lux-server.cjs');\n");if(process.platform==='darwin')copyTree(path.join(resources,'MA Web Remote Reader.app'),path.join(dir,'MA Web Remote Reader.app'));}
 const manifest={schemaVersion:1,id,name,description,version,minHostVersion:'1.0.0',runtime,entry,accent,permissions:['network','data-files',...(['dsan','record','ultrix'].includes(id)?['device-control']:[])],platforms:[platform]};
 fs.writeFileSync(path.join(dir,'techhub-app.json'),JSON.stringify(manifest,null,2));const filename=`techhub-app-${id}-${version}-${platform}.zip`,dest=path.join(output,filename);pack(dir,dest);const bytes=fs.readFileSync(dest);
 catalog.apps.push({id,name,description,version,minHostVersion:'1.0.0',permissions:manifest.permissions,packages:{[platform]:{url:`https://github.com/horner516/Tech-Hub/releases/download/v${version}/${filename}`,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length}}});
 }
 fs.writeFileSync(path.join(output,'catalog.json'),JSON.stringify(catalog,null,2));fs.writeFileSync(path.join(resources,'catalog.json'),JSON.stringify(catalog,null,2));
 fs.copyFileSync(path.join(output,'catalog.json'),path.resolve('dist',`catalog-${platform}.json`));
 const all=new Zip();all.addLocalFolder(output);all.writeZip(path.resolve('dist',`Tech-Hub-All-Apps-${platform}.zip`));
 for(const [, , , , , ,files]of specs)for(const file of files)fs.rmSync(path.join(resources,file),{recursive:true,force:true});fs.rmSync(path.join(resources,'MA Web Remote Reader.app'),{recursive:true,force:true});
 console.log('Packaged six apps and offline bundle for '+platform);
}finally{fs.rmSync(stage,{recursive:true,force:true});}
