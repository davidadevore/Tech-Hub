const $=s=>document.querySelector(s);
async function refresh(){try{const r=await fetch('/api/status',{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error();const s=await r.json();$('#title').textContent=s.label;$('#status').textContent=s.status;$('#settings').hidden=!s.admin;if(!$('#dialog').open)$('#label').value=s.label;}catch{$('#status').textContent='Disconnected · waiting for the app';$('#settings').hidden=true;}}
$('#settings').onclick=()=>{$('#error').textContent='';$('#dialog').showModal();};$('#close').onclick=()=>$('#dialog').close();
$('#form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:$('#label').value})});const v=await r.json();if(!r.ok)throw Error(v.error);$('#dialog').close();await refresh();}catch(e){$('#error').textContent=e.message;}finally{e.submitter.disabled=false;}};
refresh();setInterval(refresh,3000);
