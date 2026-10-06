'use strict';
const crypto=require('node:crypto');
function validate(value={enabled:false,password:null}){
 if(!value||typeof value.enabled!=='boolean')throw Error('Invalid remote administration configuration.');
 if(value.password&&(!/^[a-f0-9]{32}$/.test(value.password.salt)||!/^[a-f0-9]{64}$/.test(value.password.hash)))throw Error('Invalid administrator password configuration.');
 if(value.enabled&&!value.password)throw Error('Remote administration requires a password.');
 return {enabled:value.enabled,password:value.password||null};
}
function createAdminAccess({getConfig,verify,now=Date.now}){
 const sessions=new Map(),attempts=new Map();
 const cookie=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('techhub_admin='))?.slice(14);
 function prune(){for(const[k,s]of sessions)if(s.expires<=now())sessions.delete(k);for(const[k,s]of attempts)if(s.until<=now())attempts.delete(k);}
 function authorized(req){prune();const session=sessions.get(cookie(req));return !!(getConfig().enabled&&session&&session.ip===req.socket.remoteAddress);}
 async function login(req,password){
  prune();if(!getConfig().enabled)return {status:403,error:'Remote administration is disabled.'};
  const key=req.socket.remoteAddress;let attempt=attempts.get(key);
  if(!attempt){if(attempts.size>=512)return {status:429,error:'Too many sign-in attempts. Try again later.'};attempt={count:0,until:now()+60000};attempts.set(key,attempt);}
  if(attempt.count++>=10)return {status:429,error:'Too many attempts. Try again in one minute.'};
  const stored=getConfig().password;
  if(typeof password!=='string'||password.length>256||!await verify(password,stored))return {status:401,error:'Incorrect administrator password.'};
  // A password/permission change while scrypt runs must not create a new session.
  if(!getConfig().enabled||getConfig().password!==stored)return {status:401,error:'Access settings changed. Sign in again.'};
  if(sessions.size>=256)sessions.delete(sessions.keys().next().value);
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{ip:key,expires:now()+3600000});attempts.delete(key);
  return {status:303,cookie:`techhub_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`};
 }
 return {authorized,expires:req=>sessions.get(cookie(req))?.expires,login,revoke:()=>sessions.clear(),logout:req=>sessions.delete(cookie(req))};
}
module.exports={validate,createAdminAccess};
