import {createClient} from '@supabase/supabase-js';
// Genuine GoTrue sessions, real AuthProvider and real RLS; QA-only account state changes.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const config=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
const baseline=false;
const manager=config.users.find(a=>a.kind==='diocese_a');
const managerClient=createClient(config.url,config.apiKey,{auth:{persistSession:false,autoRefreshToken:false}});
await managerClient.auth.setSession(manager.session);
const manage=async(active)=>{const r=await managerClient.rpc('set_managed_user_active',{p_profile_id:config.users.find(a=>a.kind==='parish_a1').profileId,p_active:active});if(r.error)throw Error(r.error.message)};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v208-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v208-live-auth/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:4858/')).ok}catch{}if(ready)break;await sleep(100)}if(!ready)throw Error('Vite unavailable');
 // Hosted Linux runners can restrict Chromium user namespaces; this browser only serves isolated fake data.
 const platformFlags=process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[];
 let chromeDiagnostics='';
 browser=spawn(chrome,[...platformFlags,'--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',chunk=>{chromeDiagnostics=(chromeDiagnostics+chunk.toString()).slice(-2400)});
 browser.on('error',error=>{chromeDiagnostics=error.message});
 const portfile=path.join(tmp,'DevToolsActivePort');
 for(let i=0;i<300&&!fs.existsSync(portfile);i++){if(browser.exitCode!==null||browser.signalCode)break;await sleep(100)}
 if(!fs.existsSync(portfile))throw Error('Chrome startup failed (exit='+browser.exitCode+'): '+chromeDiagnostics);
 let port;for(let retry=0;retry<50;retry++){try{const candidate=fs.readFileSync(portfile,'utf8').split(/\r?\n/)[0];if(/^\d+$/.test(candidate)){port=candidate;break}}catch{}await sleep(50)}if(!port)throw Error('Chrome debugging port unavailable');
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 const pending=new Map();let seq=0;const heldProfiles=[];let profileRequests=0,holdProfiles=false,failLogout=false,failedLogoutRequests=0;const target=config.users.find(a=>a.kind==='parish_a1');
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
 socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);m.error?cb.reject(Error(m.error.message)):cb.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||'JS exception');
  if(m.method==='Fetch.requestPaused'){
   const url=m.params.request.url;
   if(failLogout&&url.includes('/auth/v1/logout')){failedLogoutRequests++;call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'InternetDisconnected'}).catch(()=>{});return}
   if(holdProfiles&&url.includes('/rest/v1/user_profiles')&&url.includes(target.id)){profileRequests++;if(profileRequests===(baseline?2:1)){heldProfiles.push(m.params.requestId);return}}
   if(!url.startsWith('http://127.0.0.1:4858/')&&!url.startsWith(config.url+'/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("(()=>{const q=window.__qa208;return {text:document.querySelector('#root')?.textContent||'',ready:q?.ready,result:q?.result,state:q?.state,events:q?.events}})()");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<100;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});




 const reset=async()=>{await call('Page.navigate',{url:'http://127.0.0.1:4858/'});await waitFor(s=>s.ready,'ready');await evaluate('window.__qa208.clearStorage()');await evaluate('window.__qa208=undefined');await call('Page.reload',{ignoreCache:true});await waitFor(s=>s.ready&&!s.state.authenticated,'anonymous')};
 const login=async account=>{await evaluate('window.__qa208.startLogin('+JSON.stringify(account.email)+','+JSON.stringify(account.password)+')');return await waitFor(s=>s.result,'login settled')};
 const test=async(kind,fn)=>{const failures=[];let evidence;try{evidence=await fn()}catch(e){failures.push(e.message)}rows.push({kind,passed:!failures.length,failures,evidence});console.log((failures.length?'FAIL ':'PASS ')+kind+' '+JSON.stringify(failures))};
 for(const offline of [false,true])await test(offline?'app-logout-network-failure':'app-logout-online',async()=>{
  await reset();const s=await login(target);if(!s.result.success)throw Error('Login failed');
  failLogout=offline;
  await evaluate('window.__qa208.logout()');
  await sleep(1800);await waitFor(s=>s.ready&&!s.state.authenticated&&!s.state.userId,'logout and navigation');
  const persisted=await evaluate("Object.keys(localStorage).filter(k=>k.endsWith('-auth-token')||k==='currentUser'||k==='sacraments_user_profile')");
  if(persisted.length)throw Error('Logout retained persisted credentials or role');
  if(offline&&!failedLogoutRequests)throw Error('Logout request was not failed by network control');
  failLogout=false;await evaluate('window.__qa208=undefined');await call('Page.reload',{ignoreCache:true});
  const final=await waitFor(s=>s.ready&&!s.state.authenticated,'anonymous after reconnect and reload');
  return {offline,failedLogoutRequests,persistedKeys:persisted,final};
 });
 await test('blocked-session-and-reactivation',async()=>{
  await reset();let s=await login(target);if(!s.result.success)throw Error('Login failed');
  try{
   await manage(false);await evaluate('window.__qa208.refresh()');
   const blocked=await waitFor(s=>s.result?.refreshed&&!s.state.authenticated&&s.state.configurationError,'blocked profile');
   await evaluate('window.__qa208=undefined');await call('Page.reload',{ignoreCache:true});await waitFor(s=>s.ready&&!s.state.authenticated&&s.state.configurationError,'blocked reload');
   s=await login(target);if(s.result.success||!s.result.configurationError)throw Error('Blocked login accepted');
   const access=createClient(config.url,config.apiKey,{auth:{persistSession:false,autoRefreshToken:false}});await access.auth.setSession(target.session);
   const denied=await access.rpc('qa_v208_concurrency_probe',{p_parish_id:target.parishId,p_mode:'bautismo',p_request_id:crypto.randomUUID(),p_delay_ms:0});
   if(!denied.error||denied.error.code==='P0208')throw Error('Blocked user reached protected transaction');
   await manage(true);await evaluate('window.__qa208.refresh()');const reactivated=await waitFor(s=>s.result?.refreshed&&s.state.authenticated,'reactivated profile');
   return {blocked,protectedRpcDenied:{code:denied.error.code,message:denied.error.message},reactivated};
  }finally{await manage(true)}
 });
 await test('late-first-login-cannot-replace-second-user',async()=>{
  await reset();holdProfiles=true;profileRequests=0;heldProfiles.length=0;
  await evaluate('window.__qa208.startLogin('+JSON.stringify(target.email)+','+JSON.stringify(target.password)+')');
  for(let i=0;i<120&&!heldProfiles.length;i++)await sleep(70);if(!heldProfiles.length)throw Error('No first profile held');
  const second=config.users.find(a=>a.kind==='parish_a2');let secondState=await login(second);if(!secondState.result.success)throw Error('Second login failed');
  holdProfiles=false;for(const requestId of heldProfiles)await call('Fetch.continueRequest',{requestId});await sleep(900);
  const final=await state();if(final.state.userId!==second.id||!final.state.authenticated)throw Error('Stale first login replaced newer user');
  return {final};
 });
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const report={protocol:'V208',scope:'Real AuthProvider, genuine GoTrue accounts, actual logout with failed network, institutional block/reactivation and out-of-order profile responses',date:new Date().toISOString(),sourceSha256:createHash('sha256').update(fs.readFileSync('src/context/AuthContext.jsx','utf8').replace(/\r\n/g,'\n')).digest('hex'),rows,exceptions,externalRequests};
fs.writeFileSync('AUDITORIA_AUTH_RESILIENCIA_V208.json',JSON.stringify(report,null,2)+'\n');
if(rows.some(r=>!r.passed)||exceptions.length||externalRequests.length)process.exitCode=1;