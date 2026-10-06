'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function stageRtoo(target){
 const source=path.resolve(__dirname,'../services/rtoo');
 fs.mkdirSync(target,{recursive:true});
 for(const name of fs.readdirSync(source))if(name!=='node_modules')fs.cpSync(path.join(source,name),path.join(target,name),{recursive:true});
 const copied=new Set();
 function dependency(name,from){
  if(copied.has(name))return;copied.add(name);
  let dir=path.dirname(require.resolve(name,{paths:[from]}));
  while(!fs.existsSync(path.join(dir,'package.json'))||JSON.parse(fs.readFileSync(path.join(dir,'package.json'))).name!==name){const parent=path.dirname(dir);if(parent===dir)throw Error('Dependency not found: '+name);dir=parent;}
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'package.json')));
  fs.cpSync(dir,path.join(target,'node_modules',name),{recursive:true,dereference:true,filter:p=>path.basename(p)!=='node_modules'&&path.basename(p)!=='.bin'});
  for(const child of Object.keys(manifest.dependencies||{}))dependency(child,dir);
 }
 for(const name of Object.keys(require('../services/rtoo/package.json').dependencies))dependency(name,source);
}
if(require.main===module){const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rtoo-package-'));try{stageRtoo(temp);const output=process.argv[2]||'dist/techhub-app-rtoo-1.0.0-universal.zip';require('../sdk/package.cjs').pack(temp,output);console.log(path.resolve(output));}finally{fs.rmSync(temp,{recursive:true,force:true});}}
module.exports={stageRtoo};
