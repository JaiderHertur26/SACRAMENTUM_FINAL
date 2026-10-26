// Actual React page, in-memory fictitious services. NO authenticated production E2E.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v206-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v206-seat-recovery/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:4856/')).ok}catch{}if(ready)break;await sleep(100)}if(!ready)throw Error('Vite unavailable');
 // Hosted Linux runners can restrict Chromium user namespaces; this browser only serves isolated fake data.
 const platformFlags=process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[];
 let chromeDiagnostics='';
 browser=spawn(chrome,[...platformFlags,'--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',chunk=>{chromeDiagnostics=(chromeDiagnostics+chunk.toString()).slice(-2400)});
 browser.on('error',error=>{chromeDiagnostics=error.message});
 const portfile=path.join(tmp,'DevToolsActivePort');
 for(let i=0;i<300&&!fs.existsSync(portfile);i++){if(browser.exitCode!==null||browser.signalCode)break;await sleep(100)}
 if(!fs.existsSync(portfile))throw Error('Chrome startup failed (exit='+browser.exitCode+'): '+chromeDiagnostics);
 const port=fs.readFileSync(portfile,'utf8').split(/\r?\n/)[0];
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
   if(!url.startsWith('http://127.0.0.1:4856/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("(()=>{const q=window.__qa206;return {text:document.querySelector('#root')?.textContent||'',buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,disabled:b.disabled})),calls:q?.calls,pending:q?.pending.map(r=>r.id),reported:q?.reported.map(r=>r.id),next:q?.next,reads:q?.reads,toasts:q?.toasts,confirmCalls:q?.confirmCalls}})()");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<100;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});

 const definitions=[
  ...['bautismo','confirmacion'].flatMap(kind=>['individual-timeout','individual-lost-response','individual-read-failure','success-read-failure','batch-timeout','batch-lost-response','batch-read-failure','initial-read-error','batch-cancel'].map(scenario=>({kind,scenario}))),
  ...['individual-timeout','individual-lost-response','individual-read-failure','success-read-failure','initial-read-error','double-across-records'].map(scenario=>({kind:'exequias',scenario}))
 ];
 const actionable=s=>s.buttons.some(b=>!b.disabled&&(b.text.includes('Firmar y Sellar Permanente')||b.text.includes('Asentar ahora')));
 const pendingTab=async()=>{await click('Pendientes (');await waitFor(actionable,'pending tab')};
 for(const {kind,scenario} of definitions){
  const faults=[];let first,final;
  const check=(condition,label)=>{if(!condition)faults.push(label)};
  const funeral=kind==='exequias',batch=scenario.startsWith('batch');
  try{
   await call('Page.navigate',{url:'http://127.0.0.1:4856/?kind='+kind+'&case='+scenario});
   await waitFor(s=>s.text.includes('No fue posible verificar')||(funeral?s.text.includes('Pendientes (3)'):actionable(s)),'initial render');
   if(scenario==='initial-read-error'){
    first=await state();check(first.text.includes('No fue posible verificar'),'read error treated as empty archive');
    await evaluate('window.__qa206.failRead=false');
    check(await click('Reintentar sincronizaci'),'no read retry');
    await waitFor(s=>funeral?s.text.includes('Pendientes (3)'):actionable(s),'initial read retry');
    if(funeral)await pendingTab();
    final=await state();check(final.calls.length===0,'sync retry wrote data');
   }else{
    if(funeral)await pendingTab();
    if(batch){await click('Por Lote');await waitFor(s=>s.text.includes('Asentar Selecci'),'batch mode');await evaluate("document.querySelector('thead button').click()");await waitFor(s=>s.text.includes('Seleccionados: 3'),'selection')}
    const label=funeral?'Asentar ahora':batch?'Asentar Selecci':'Firmar y Sellar Permanente';
    if(scenario==='batch-cancel'){
     await evaluate('window.__qa206.confirm=false');await click(label,true);await sleep(180);
     first=await state();check(first.calls.length===0&&first.confirmCalls===1,'duplicate confirmation or write after cancel');
     await evaluate('window.__qa206.confirm=true');await click(label,true);
     final=await waitFor(s=>s.reported?.length===3&&!s.buttons.some(b=>b.text.includes('Asentar Selecci')),'retry after cancel');
     check(final.confirmCalls===2&&final.calls.length===1,'cancel did not release lock or duplicated batch');
    }else if(scenario==='double-across-records'){
     await evaluate("(()=>{let b=[...document.querySelectorAll('button')].filter(x=>x.textContent.includes('Asentar ahora'));b[0].click();b[1].click();return true})()");
     first=await waitFor(s=>s.calls?.length>0,'first seat');check(first.calls.length===1,'second row was submitted while first active');
     await waitFor(s=>s.reported?.length===1&&s.toasts.some(t=>t.title==='Registro asentado'),'first seat done');
     await pendingTab();await click(label,true);
     final=await waitFor(s=>s.reported?.length===2&&s.toasts.filter(t=>t.title==='Registro asentado').length===2,'second explicit seat');
     check(final.calls.length===2,'cross-row lock not released or duplicate writes');
    }else{
     check(await click(label,true),'seat action unavailable');
     // V219: failed reads require an explicitly settled *blocked* UI state.
     // Destructive toast and a previously enabled batch button may coexist in
     // different React commits; accepting that interim snapshot caused CI
     // false failures and incorrectly measured the settled safety contract.
     const readFailure=scenario.includes('read-failure');
     first=await waitFor(s=>s.toasts?.some(t=>t.variant==='destructive')&&
       (readFailure?s.text.includes('No fue posible verificar'):
       (s.text.includes('No fue posible verificar')||s.buttons.some(b=>!b.disabled&&(b.text.includes('Por Lote')||b.text.includes('Asentar ahora'))))),'failure verification');
     check(first.calls.length===1,'double click or automatic write replay');
     check(first.toasts.some(t=>t.description?.length>20),'missing error explanation');
     if(readFailure){
      check(first.text.includes('No fue posible verificar'),'unverified state remained writable');
      check(!actionable(first)&&!first.buttons.some(b=>b.text.includes('Asentar Selecci')),'write shown with unverified snapshot');
      await evaluate('window.__qa206.failRead=false');
      check(await click('Reintentar sincronizaci'),'missing synchronization retry');
      await waitFor(s=>!s.text.includes('No fue posible verificar')&&(funeral?s.text.includes('Pendientes ('):s.buttons.some(b=>b.text.includes('Por Lote'))),'verified state restored');
     }else check(first.reads>(funeral?3:2),'no read verification after response failure');
     const restored=await state();
     if(batch&&scenario!=='batch-timeout'){
      check(restored.pending.length===0&&restored.reported.length===3,'committed batch state not reflected');
      check(!restored.buttons.some(b=>!b.disabled&&b.text.includes('Asentar Selecci')),'committed batch still offered for re-seat');
      final=restored;
     }else if(scenario==='success-read-failure'){
      check(restored.pending.length===2&&restored.calls.length===1,'success refresh failure caused replay');
      final=restored;
     }else{
      const remaining=scenario.includes('timeout')?3:2;
      check(restored.pending.length===remaining,'wrong pending records after verification');
      if(!funeral&&!batch)check(restored.text.includes(String(restored.next).padStart(4,'0')),'stale displayed consecutive');
      if(batch)check(restored.text.includes('Seleccionados: 3'),'uncommitted selection lost');
      check(await click(label,true),'explicit retry unavailable');
      const expected=batch?3:scenario.includes('timeout')?1:2;
      final=await waitFor(s=>s.reported?.length===expected&&s.reads>restored.reads,'explicit retry completion');
      check(final.calls.length===2,'explicit retry count mismatch');
      const expectedId=scenario.includes('timeout')?'qa-1':'qa-2';
      if(!batch)check(final.calls[1]?.ids?.[0]===expectedId,'retry targeted an already committed record');
     }
    }
   }
   if(final){check(new Set(final.reported).size===final.reported.length,'duplicate official records');check(final.next===final.reported.length+1,'counter mismatch')}
  }catch(error){faults.push(error.message)}
  const compact=s=>s?{calls:s.calls,pending:s.pending,reported:s.reported,next:s.next,reads:s.reads,confirmCalls:s.confirmCalls,toasts:s.toasts?.map(t=>({title:t.title,description:t.description})),text:s.text.slice(-900)}:null;
  rows.push({kind,scenario,passed:faults.length===0,faults,first:compact(first),final:compact(final)});
  console.log((faults.length?'FAIL ':'PASS ')+kind+'/'+scenario+' '+JSON.stringify(faults));
 }
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const files=['BaptismSentarRegistrosPage.jsx','ConfirmationSentarRegistrosPage.jsx','FuneralRegistryPage.jsx'].map(x=>'src/pages/parish/'+x);
const result={protocol:'V206',scope:'Actual React pages; isolated fictitious services; no authenticated production E2E or physical network fault',sourceSha256:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),date:new Date().toISOString(),rows,passed:rows.filter(r=>r.passed).length,total:rows.length,exceptions,externalRequests};
fs.writeFileSync('AUDITORIA_RECUPERACION_TRES_SACRAMENTOS_V206.json',JSON.stringify(result,null,2)+'\n');
console.log('V206_BROWSER '+result.passed+'/'+result.total+' exceptions='+exceptions.length+' external='+externalRequests.length);
if(result.passed!==24||exceptions.length||externalRequests.length)process.exitCode=1;
