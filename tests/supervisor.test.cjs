const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {supervise}=require('../hub/supervisor.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await delay(5);}assert.fail('Supervisor did not reach expected state');}
function fixture(options={}){
 const children=[],states=[];let healthy=true,alive=0,maxAlive=0;
 const service=supervise({interval:5,startupTimeout:20,retryDelay:5,maxRetries:2,
  start(){const c=new EventEmitter();c.pid=1;c.exitCode=null;c.signalCode=null;alive++;maxAlive=Math.max(maxAlive,alive);c.kill=signal=>{if(c.exitCode!==null||c.signalCode!==null)return;setTimeout(()=>{alive--;c.signalCode=signal;c.emit('exit',null,signal);},2);};children.push(c);return c;},
  check:async()=>healthy,report:s=>states.push(s),...options});
 return{service,children,states,setHealthy:v=>healthy=v,get maxAlive(){return maxAlive;}};
}
test('recovers a crashed service, stops retrying at the limit, allows manual restart',async()=>{
 const f=fixture();try{
 await until(()=>f.states.at(-1)?.state==='running');
 for(let i=0;i<3;i++){f.children.at(-1).kill('SIGTERM');await until(()=>i===2?f.states.at(-1)?.state==='error':f.children.length===i+2&&f.states.at(-1)?.state==='running');}
 assert.equal(f.children.length,3);await delay(30);assert.equal(f.children.length,3);
 await f.service.restart();await until(()=>f.states.at(-1)?.state==='running');assert.equal(f.children.length,4);assert.equal(f.maxAlive,1);
 }finally{await f.service.stop();}
});
test('detects a hung service and cancels all recovery when stopped',async()=>{
 const f=fixture();await until(()=>f.states.at(-1)?.state==='running');f.setHealthy(false);
 await until(()=>f.children.length===2);await f.service.stop();const count=f.children.length;await delay(50);assert.equal(f.children.length,count);assert.equal(f.maxAlive,1);
});
test('startup timeout and spawn errors exhaust recovery without hanging shutdown',async()=>{
 let starts=0,state;
 const service=supervise({start(){starts++;throw Error('missing binary');},check:async()=>false,report:s=>state=s,retryDelay:1,maxRetries:1});
 await until(()=>state?.state==='error');assert.equal(starts,2);await service.stop();
 const f=fixture({check:async()=>false,maxRetries:0});await until(()=>f.states.at(-1)?.state==='error');await f.service.stop();
});
test('disabled services start only when enabled, stop without recovery, and can resume',async()=>{
 const f=fixture({autoStart:false});
 try{await delay(20);assert.equal(f.children.length,0);f.service.start();await until(()=>f.states.at(-1)?.state==='running');await f.service.stop();await delay(25);assert.equal(f.children.length,1);f.service.start();await until(()=>f.children.length===2&&f.states.at(-1)?.state==='running');assert.equal(f.maxAlive,1);}finally{await f.service.stop();}
});
