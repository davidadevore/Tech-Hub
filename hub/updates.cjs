'use strict';
const api='https://api.github.com/repos/horner516/Tech-Hub/releases';
const downloadUrl='https://github.com/horner516/Tech-Hub/releases/latest';
function version(tag) {
  const match=typeof tag==='string' && /^v?(\d{1,9})\.(\d{1,9})\.(\d{1,9})$/.exec(tag);
  return match ? match.slice(1).map(Number) : null;
}
function compare(a,b) { for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]-b[i];return 0; }
function createUpdateChecker(currentVersion,{request=fetch,now=Date.now}={}) {
  const current=version(currentVersion);
  if(!current)throw Error('Invalid installed version');
  let state={status:'idle',currentVersion,latestVersion:null,available:false,releases:[],checkedAt:null,error:null,downloadUrl};
  let pending,controller,lastAttempt=-Infinity;
  const snapshot=()=>({...state,releases:state.releases.map(r=>({...r}))});
  function check() {
    if(pending)return pending;
    if(now()-lastAttempt<60000)return Promise.resolve(snapshot());
    lastAttempt=now();controller=new AbortController();
    state={...state,status:'checking',error:null};
    pending=(async()=>{
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
      try {
        const releases=new Map();let complete=false;
        // Read the full bounded history: publish order need not match version order.
        for(let page=1;page<=10;page++) {
          const response=await request(`${api}?per_page=100&page=${page}`,{signal,redirect:'error',headers:{Accept:'application/vnd.github+json','User-Agent':'Tech-Hub-update-check'}});
          if(response.status===403||response.status===429)throw Error('GitHub is limiting update checks. Try again later or open downloads.');
          if(!response.ok)throw Error('GitHub could not complete the update check. Try again later.');
          const list=await response.json();if(!Array.isArray(list))throw Error('GitHub returned an invalid release list.');
          for(const release of list) {
            const parsed=version(release.tag_name);
            // Excludes Companion packages, previews, drafts and tags without desktop installers.
            if(!parsed||release.draft||release.prerelease||!Array.isArray(release.assets))continue;
            if(!['Tech-Hub-macOS-arm64.dmg','Tech-Hub-Windows-x64-Setup.exe'].every(name=>release.assets.some(a=>a.name===name)))continue;
            releases.set(parsed.join('.'),{version:parsed.join('.'),notes:typeof release.body==='string'&&release.body.trim()?release.body:'No release notes were published for this version.',url:`https://github.com/horner516/Tech-Hub/releases/tag/${encodeURIComponent(release.tag_name)}`});
          }
          if(list.length<100){complete=true;break;}
        }
        if(!complete)throw Error('Release history is too long to load completely. Open downloads to review the changes.');
        const sorted=[...releases.values()].sort((a,b)=>compare(version(b.version),version(a.version)));
        if(!sorted.length)throw Error('No published desktop release is available yet.');
        const newer=sorted.filter(r=>compare(version(r.version),current)>0);
        state={...state,status:'ready',latestVersion:sorted[0].version,available:newer.length>0,releases:newer,checkedAt:new Date(now()).toISOString(),error:null};
      } catch(error) {
        state={...state,status:'error',error:error.name==='AbortError'||error.name==='TimeoutError'||error instanceof TypeError?'Could not reach GitHub. Check your internet connection and try again.':error.message};
      }
      return snapshot();
    })().finally(()=>{pending=null;});
    return pending;
  }
  return {snapshot,check,stop:()=>controller?.abort()};
}
module.exports={createUpdateChecker};
