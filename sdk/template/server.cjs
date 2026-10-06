'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const runtime=require(process.env.TECH_HUB_RUNTIME_API||'../../hub/runtime-api.cjs');
let settings=runtime.readSettings({label:'Example Meter'});
const server=http.createServer(async(req,res)=>{
 const json=(status,value)=>runtime.json(res,status,value);
 const admin=runtime.isAdministrator(req);
 if(req.url==='/api/status'&&req.method==='GET')return json(200,{label:settings.label,status:'No device configured',admin});
 if(req.url==='/api/settings'&&req.method==='POST'){
  if(!admin)return json(403,{error:'Administrator access required'});
  if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return json(403,{error:'Origin rejected'});
  try{const value=await runtime.readJSON(req,4096);if(typeof value.label!=='string'||!value.label.trim()||value.label.length>80)throw Error('Enter a label of 1–80 characters');const next={label:value.label.trim()};runtime.saveSettings(next);settings=next;return json(200,{ok:true});}catch(e){return json(400,{error:e.message});}
 }
 const assets={'/':['index.html','text/html'],'/tech-hub.css':['tech-hub.css','text/css'],'/app.js':['app.js','text/javascript']};
 if(req.method==='GET'&&assets[req.url]){const [name,type]=assets[req.url];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(__dirname,'public',name)));}json(404,{error:'Not found'});
});
runtime.listen(server);
