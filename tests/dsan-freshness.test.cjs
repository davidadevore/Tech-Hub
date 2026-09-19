const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('disconnected and stale timers clear desktop, mobile, fullscreen, running indicators and lamps',()=>{
 const elements=new Map();
 const $=id=>{if(!elements.has(id)){const label={textContent:'Running'};elements.set(id,{hidden:true,className:'running',classList:{remove(){},toggle(){}},querySelector:()=>label});}return elements.get(id);};
 const html=fs.readFileSync(require.resolve('../services/dsan/index.html'),'utf8');
 const fn=html.slice(html.indexOf('    function renderLimitimer'),html.indexOf('    function renderCue'));
 const ctx=vm.createContext({$,setStatus(){},renderClock(el,time){el.time=time;},viewerTime:()=> '02:30'});vm.runInContext(fn,ctx);
 for(const device of [{status:'disconnected',packet_count:1,data:{active:{running:true}}},{status:'connected',stale:true,packet_count:2,data:{active:{running:true}}}]){
  ctx.device=device;vm.runInContext('renderLimitimer(device)',ctx);
  for(const id of ['clock','fullscreen-clock','mobile-clock'])assert.equal($(id).time,'--:--');
  assert.equal($('timer-connection-warning').hidden,false);assert.equal($('timer-state').querySelector().textContent,'Unavailable');
 }
 ctx.device={status:'disabled',packet_count:0};vm.runInContext('renderLimitimer(device)',ctx);assert.equal($('timer-connection-warning').hidden,true);
 ctx.device={status:'connected',stale:false,packet_count:3,data:{active:{running:true,signal:'green'},selected_program:1}};vm.runInContext('renderLimitimer(device)',ctx);assert.equal($('clock').time,'02:30');assert.equal($('timer-connection-warning').hidden,true);
});
