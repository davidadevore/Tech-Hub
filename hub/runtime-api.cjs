'use strict';
// Versioned helper API used by apps through TECH_HUB_RUNTIME_API.
const fs=require('node:fs'),path=require('node:path');
const API_VERSION=1;
function context(env=process.env){
 const port=Number(env.TECH_HUB_BACKEND_PORT),dataDir=env.TECH_HUB_DATA_DIR;
 if(!dataDir||!Number.isInteger(port)||port<1||port>65535)throw Error('Launch this app through Tech Hub or the SDK development runner');
 return Object.freeze({apiVersion:API_VERSION,port,host:'127.0.0.1',dataDir,appRoot:env.TECH_HUB_APP_ROOT,hostVersion:env.TECH_HUB_VERSION});
}
function settingsFile(name){if(!/^[a-zA-Z0-9_-]+\.json$/.test(name))throw Error('Use a simple JSON settings filename');return path.join(context().dataDir,name);}
function readSettings(defaults,name='settings.json'){const file=settingsFile(name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):structuredClone(defaults);}
function saveSettings(value,name='settings.json'){const file=settingsFile(name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file);}
function isAdministrator(req){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&req.headers['x-techhub-local-client']==='1';}
async function readJSON(req,limit=65536){let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('Request too large');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
function listen(server){const c=context();server.listen(c.port,c.host);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.closeAllConnections();server.close(()=>process.exit(0));});return server;}
module.exports={API_VERSION,context,readSettings,saveSettings,isAdministrator,readJSON,json,listen};
