'use strict';
const http=require('node:http');
// Dispatch the original request to the existing gateway. No loopback proxy is
// involved, so remote addresses, password checks and local-only controls survive.
function createNamedRouter({getRoutes,directory,host='0.0.0.0',port=80}){
 let server=null;const state={available:false,port:null,error:null};
 async function stop(){state.available=false;state.port=null;if(!server)return;const old=server;server=null;old.closeAllConnections();await new Promise(r=>old.close(r));}
 async function start(){
  await stop();state.error=null;
  const candidate=http.createServer((req,res)=>{
   const authority=req.headers.host||'';
   const match=/^([a-z0-9-]+\.local)(?::([0-9]+))?$/i.exec(authority);
   const route=match&&(!match[2]||Number(match[2])===state.port)&&getRoutes().get(match[1].toLowerCase());
   if(!route){res.writeHead(421,{'Content-Type':'text/plain'});res.end('Unknown Tech Hub hostname.');return;}
   if(route==='directory')directory(req,res);else route.emit('request',req,res);
  });
  candidate.requestTimeout=15000;
  // Service gateways currently use HTTP/SSE; never tunnel an unchecked upgrade.
  candidate.on('upgrade',(_req,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  try{
   await new Promise((resolve,reject)=>{candidate.once('error',reject);candidate.listen(port,host,()=>{candidate.removeListener('error',reject);resolve();});});
   server=candidate;state.port=candidate.address().port;state.available=true;
  }catch(error){
   state.error=error.code==='EADDRINUSE'?'Port 80 is in use by another application. Use the links with port numbers, or free port 80 and retry.':error.code==='EACCES'?'This computer did not allow Tech Hub to use port 80. Use the links with port numbers.':'Unable to open port 80. Use the links with port numbers.';
  }
  return {...state};
 }
 return {state,start,stop};
}
module.exports={createNamedRouter};
