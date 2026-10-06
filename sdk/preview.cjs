'use strict';
const http=require('node:http'),net=require('node:net'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const {validate}=require('./validate.cjs');
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve(server.address().port);});});
async function serve(directory,{viewer=false,report=true}={}){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'techhub-sdk-preview-')),log=path.join(data,'preview.log'),root=path.join(data,'module');let child,gateway,closed=false;
 const close=async()=>{if(closed)return;closed=true;for(const sig of ['SIGINT','SIGTERM'])process.removeListener(sig,onSignal);gateway?.closeAllConnections();await new Promise(r=>gateway?.listening?gateway.close(r):r());if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await new Promise(r=>{const timer=setTimeout(()=>{child.kill('SIGKILL');r();},2000);child.once('exit',()=>{clearTimeout(timer);r();});});}fs.rmSync(data,{recursive:true,force:true});};
 const onSignal=()=>{close().catch(()=>{});};
 try{
  require('./dev.cjs').stage(directory,root);const {manifest}=validate(root);
  if(manifest.runtime!=='node'||manifest.runtimeAPI!==1)throw Error('Standalone preview requires a Node module with runtimeAPI: 1');
  const reservation=net.createServer();const backend=await listen(reservation);await new Promise(r=>reservation.close(r));
  child=spawn(process.execPath,[path.join(root,manifest.entry)],{cwd:root,windowsHide:true,env:{...process.env,TECH_HUB_BACKEND_HOST:'127.0.0.1',TECH_HUB_BACKEND_PORT:String(backend),TECH_HUB_DATA_DIR:data,TECH_HUB_APP_ROOT:root,TECH_HUB_VERSION:manifest.minHostVersion,TECH_HUB_MANAGED:'1',TECH_HUB_RUNTIME_API:path.resolve(__dirname,'../hub/runtime-api.cjs')},stdio:['ignore','pipe','pipe']});
  let spawnError,logBytes=0;child.on('error',e=>spawnError=e);
  const logChunk=chunk=>{if(logBytes>=65536)return;const part=chunk.subarray(0,65536-logBytes);logBytes+=part.length;fs.appendFileSync(log,part);};child.stdout.on('data',logChunk);child.stderr.on('data',logChunk);
  let ready=false;
  for(let i=0;i<60;i++){if(spawnError)throw spawnError;if(child.exitCode!==null)throw Error('Module exited during startup. Run focused tests or inspect its entry point.');try{const r=await fetch('http://127.0.0.1:'+backend,{signal:AbortSignal.timeout(500)});ready=r.ok;await r.body?.cancel();}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw Error('Module did not return HTTP 200 at / during startup');
  gateway=http.createServer((req,res)=>{
   const authority='127.0.0.1:'+gateway.address().port;
   if(req.headers.host!==authority||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!=='http://'+authority){res.writeHead(403);return res.end('Preview origin rejected');}
   const headers={...req.headers,host:'127.0.0.1:'+backend,'x-techhub-local-client':viewer?'0':'1'};
   delete headers.authorization;delete headers.cookie;if(headers.origin)headers.origin='http://127.0.0.1:'+backend;
   const upstream=http.request({hostname:'127.0.0.1',port:backend,path:req.url,method:req.method,headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.setTimeout(15000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Module unavailable');});res.on('close',()=>upstream.destroy());req.pipe(upstream);
  });
  const port=await listen(gateway),url='http://127.0.0.1:'+port;
  for(const sig of ['SIGINT','SIGTERM'])process.once(sig,onSignal);
  if(report)console.log(JSON.stringify({ok:true,mode:viewer?'viewer':'administrator',url,temporaryData:data,log,note:'Development preview only. No host navigation, service passwords, library, or network isolation. Ctrl-C stops and deletes temporary settings.'}));
  return report?undefined:{url,data,log,close};
 }catch(e){await close();throw e;}
}
module.exports={serve};
