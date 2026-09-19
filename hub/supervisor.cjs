'use strict';
// One owner per child; retries never overlap a process that is still shutting down.
function supervise({start, check, report, interval=5000, startupTimeout=30000, retryDelay=1000, maxRetries=3}) {
 let child, timer, stopped=false, generation=0, retries=0, failures=0, started=0, running=false, operation=Promise.resolve();
 const schedule=(fn,ms)=>{clearTimeout(timer);timer=setTimeout(fn,ms);timer.unref?.();};
 async function terminate() {
  const current=child; child=null;
  if(!current || current.exitCode!==null || current.signalCode!==null || !current.pid)return;
  await new Promise(resolve=>{
   const kill=setTimeout(()=>current.kill('SIGKILL'),3000);
   current.once('exit',()=>{clearTimeout(kill);resolve();});current.kill('SIGTERM');
  });
 }
 async function fail(message, token) {
  if(stopped||token!==generation)return;
  ++generation;clearTimeout(timer);report({state:'recovering',error:message});
  await terminate();
  if(stopped)return;
  if(retries>=maxRetries){report({state:'error',error:message+' Automatic recovery limit reached. Use Restart service.'});return;}
  retries++;schedule(launch,retryDelay*2**(retries-1));
 }
 async function probe(token) {
  if(stopped||token!==generation)return;
  let healthy=false;try{healthy=await check();}catch{}
  if(stopped||token!==generation)return;
  if(healthy){failures=0;running=true;report({state:'running',error:null});}
  else if((running&&++failures>=3)||(!running&&Date.now()-started>=startupTimeout)) {
   operation=fail('Service health check failed.',token);return;
  }
  schedule(()=>probe(token),running?interval:Math.min(300,interval));
 }
 function launch() {
  if(stopped)return;
  const token=++generation;started=Date.now();running=false;failures=0;report({state:'starting',error:null});
  try {child=start();}catch(error){operation=fail(error.message,token);return;}
  child.once('error',error=>{operation=fail(error.message,token);});
  child.once('exit',(code,signal)=>{operation=fail(`Service stopped (${signal||code}).`,token);});
  schedule(()=>probe(token),Math.min(500,interval));
 }
 launch();
 return {
  async restart(){++generation;clearTimeout(timer);await operation;clearTimeout(timer);await terminate();if(!stopped){retries=0;launch();}},
  async stop(){stopped=true;++generation;clearTimeout(timer);await operation;await terminate();}
 };
}
module.exports={supervise};
