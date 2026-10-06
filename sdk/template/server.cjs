'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const port=Number(process.env.TECH_HUB_BACKEND_PORT||18900),dir=process.env.TECH_HUB_DATA_DIR;
if(!dir)throw Error('Set TECH_HUB_DATA_DIR to a persistent data directory');
fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'settings.json');
let settings=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{label:'Example Meter'};
const server=http.createServer(async(req,res)=>{
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
 const admin=loopback&&(process.env.TECH_HUB_MANAGED!=='1'||req.headers['x-techhub-local-client']==='1');
 if(req.url==='/api/status'&&req.method==='GET')return json(200,{label:settings.label,status:'No device configured',admin});
 if(req.url==='/api/settings'&&req.method==='POST'){
  if(!admin)return json(403,{error:'Administrator access required'});
  if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return json(403,{error:'Origin rejected'});
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Request too large');}const value=JSON.parse(body);if(typeof value.label!=='string'||!value.label.trim()||value.label.length>80)throw Error('Enter a label of 1–80 characters');const next={label:value.label.trim()};fs.writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});fs.renameSync(file+'.tmp',file);settings=next;return json(200,{ok:true});}catch(e){return json(400,{error:e.message});}
 }
 const assets={'/':['index.html','text/html'],'/tech-hub.css':['tech-hub.css','text/css'],'/app.js':['app.js','text/javascript']};
 if(req.method==='GET'&&assets[req.url]){const [name,type]=assets[req.url];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(__dirname,'public',name)));}json(404,{error:'Not found'});
});
server.listen(port,process.env.TECH_HUB_BACKEND_HOST||'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
