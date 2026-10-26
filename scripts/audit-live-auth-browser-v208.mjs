// Actual React page, in-memory fictitious services. NO authenticated production E2E.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const config=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
const baseline=process.argv.includes('--baseline');
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
 const pending=new Map();let seq=0;
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
 socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);m.error?cb.reject(Error(m.error.message)):cb.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||'JS exception');
  if(m.method==='Fetch.requestPaused'){
   const url=m.params.request.url;
   if(!url.startsWith('http://127.0.0.1:4858/')&&!url.startsWith(config.url+'/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("(()=>{const q=window.__qa208;return {text:document.querySelector('#root')?.textContent||'',ready:q?.ready,result:q?.result,state:q?.state,events:q?.events}})()");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<100;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});


 const accounts=baseline?[config.users.find(a=>a.kind==='parish_a1')]:config.users;
 for(const account of accounts){
  const failures=[];let before,after;
  try{
   await call('Page.navigate',{url:'http://127.0.0.1:4858/'});
   await waitFor(s=>s.ready,'probe initialized');
   await evaluate('window.__qa208.clearStorage()');
   await evaluate('window.__qa208=undefined');await call('Page.reload',{ignoreCache:true});
   await waitFor(s=>s.ready&&!s.state?.authenticated,'anonymous initialized');
   await evaluate('window.__qa208.startLogin('+JSON.stringify(account.email)+','+JSON.stringify(account.password)+')');
   let result;
   for(let i=0;i<160;i++){result=await state();if(result.result)break;await sleep(70)}
   before=result;
   if(!result.result?.success)failures.push('login did not settle successfully');
   if(result.state?.userId!==account.id||result.state?.role!==account.role)failures.push('authenticated projection mismatch');
   if(!baseline&&!failures.length){
    await evaluate('window.__qa208=undefined');await call('Page.reload',{ignoreCache:true});await waitFor(s=>s.ready&&s.state?.authenticated,'session restored after refresh');
    after=await state();if(after.state.userId!==account.id)failures.push('refresh changed identity');
    await evaluate('window.__qa208.refresh()');await waitFor(s=>s.result?.refreshed,'token refresh resolved');
    await evaluate('window.__qa208.signOut()');await waitFor(s=>s.result?.signedOut&&!s.state?.authenticated,'sign out cleared UI');
    const end=await state();if(end.state.userId||end.state.role)failures.push('sign out retained role');
   }
  }catch(error){failures.push(error.message)}
  rows.push({kind:account.kind,passed:failures.length===0,failures,login:before,restored:after});
  console.log((failures.length?'FAIL ':'PASS ')+account.kind+' '+JSON.stringify(failures));
 }
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const report={protocol:'V208',scope:'Actual AuthProvider and SDK using genuine GoTrue sessions and QA-only accounts, real profile/RLS requests',date:new Date().toISOString(),sourceSha256:createHash('sha256').update(fs.readFileSync('src/context/AuthContext.jsx','utf8').replace(/\r\n/g,'\n')).digest('hex'),rows,passed:rows.filter(r=>r.passed).length,total:rows.length,exceptions,externalRequests};
fs.writeFileSync(baseline?'AUDITORIA_AUTH_BROWSER_BASELINE_V208.json':'AUDITORIA_AUTH_BROWSER_V208.json',JSON.stringify(report,null,2)+'\n');
console.log('V208_AUTH_BROWSER '+report.passed+'/'+report.total+' exceptions='+exceptions.length+' blocked_external='+externalRequests.length);
if(report.passed!==report.total||exceptions.length||externalRequests.length)process.exitCode=1;