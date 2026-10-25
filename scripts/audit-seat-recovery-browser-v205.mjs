// Actual React page, in-memory fictitious services. NO authenticated production E2E.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const baseline=process.argv.includes('--baseline');
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v205-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v205-seat-recovery/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:4855/')).ok}catch{}if(ready)break;await sleep(100)}if(!ready)throw Error('Vite unavailable');
 browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:'ignore'});
 const portfile=path.join(tmp,'DevToolsActivePort');for(let i=0;i<80&&!fs.existsSync(portfile);i++)await sleep(100);
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
   if(!url.startsWith('http://127.0.0.1:4855/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("(()=>{const q=window.__qa205;return {text:document.querySelector('#root')?.textContent||'',buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,disabled:b.disabled})),calls:q?.calls,pending:q?.pending.map(r=>r.id),reported:q?.reported.map(r=>r.id),next:q?.next,reads:q?.reads,toasts:q?.toasts,confirmCalls:q?.confirmCalls}})()");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<100;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 const scenarios=['individual-reject','individual-lost-response','individual-read-failure','batch-partial','batch-lost-response','batch-read-failure','initial-read-error','batch-cancel'];
 for(const scenario of scenarios){
  const faults=[];let first,final;
  const check=(condition,message)=>{if(!condition)faults.push(message)};
  try{
   await call('Page.navigate',{url:'http://127.0.0.1:4855/?case='+scenario});
   await waitFor(s=>s.text.includes('Firmar y Sellar Permanente')||s.text.includes('No fue posible verificar'), 'initial load');
   if(scenario==='initial-read-error'){
    first=await state();check(first.text.includes('No fue posible verificar'),'initial read failure hidden as empty archive');
    await evaluate('window.__qa205.failRead=false');check(await click('Reintentar sincronización'),'missing read recovery');
    final=await waitFor(s=>s.text.includes('Firmar y Sellar Permanente'),'read restored');check(final.calls.length===0,'read retry wrote data');
   }else{
    const batch=scenario.startsWith('batch');
    if(batch){await click('Por Lote');await evaluate("document.querySelector('thead button').click()");await sleep(70)}
    const label=batch?'Asentar Selección':'Firmar y Sellar Permanente';
    if(scenario==='batch-cancel'){
     await evaluate('window.__qa205.confirm=false');await click(label,true);await sleep(230);
     first=await state();check(first.calls.length===0&&first.confirmCalls===1,'cancel/double confirmation not guarded');
     await evaluate('window.__qa205.confirm=true');await click(label,true);
     final=await waitFor(s=>s.reported?.length===3&&s.text.includes('Boletas matrimoniales emitidas'),'retry after cancel');
     check(final.calls.length===3&&final.confirmCalls===2,'cancel left lock or duplicate confirmation');
    }else{
     check(await click(label,true),'missing enabled seat action');
     const expectedCalls=batch?2:1;
     first=await waitFor(s=>(s.toasts||[]).some(t=>t.variant==='destructive')&&s.buttons.some(b=>!b.disabled)&&(s.text.includes('No fue posible verificar')||s.text.includes('Sentar Registros de Matrimonio')),'failure recovery');
     check(first.calls.length===expectedCalls,'duplicate or automatic mutation replay');
     check(first.toasts.some(t=>t.description?.length>20),'missing actionable failure detail');
     if(scenario.includes('read-failure')){
      check(first.text.includes('No fue posible verificar'),'unverified snapshot remained writable');
      check(!first.buttons.some(b=>b.text.includes('Firmar y Sellar')||b.text.includes('Asentar Selección')),'write action shown after failed refresh');
      await evaluate('window.__qa205.failRead=false');check(await click('Reintentar sincronización'),'missing sync retry');
      await waitFor(s=>s.text.includes('Sentar Registros de Matrimonio'),'verification restored');
     }else{
      check(first.reads>3,'no post-failure verification');
     }
     if(batch){
      const expectedPending=scenario==='batch-partial'?2:1;
      check((await state()).text.includes('Seleccionados: '+expectedPending),'selection includes committed marriages');
     }else{
      check((await state()).text.includes(String(first.next).padStart(4,'0')),'counter was not refreshed');
     }
     // The user explicitly retries; the page must submit only remaining boletas.
     check(await click(label,true),'retry action unavailable');
     final=await waitFor(s=>s.reported?.length===(batch?3:(scenario==='individual-reject'?1:2))&&s.text.includes('Boletas matrimoniales emitidas'),'explicit retry');
     check(final.calls.length===(scenario==='batch-partial'?4:scenario.startsWith('batch')?3:2),'wrong retry mutation count');
     check(new Set(final.reported).size===final.reported.length,'duplicate official record');
     check(final.next===final.reported.length+1,'counter skipped or duplicated');
    }
   }
  }catch(e){faults.push(e.message)}
  const trim=s=>s?{calls:s.calls,pending:s.pending,reported:s.reported,next:s.next,reads:s.reads,confirmCalls:s.confirmCalls,toasts:s.toasts?.map(t=>({title:t.title,description:t.description})),text:s.text.slice(-700)}:null;
  rows.push({scenario,passed:faults.length===0,faults,first:trim(first),final:trim(final)});
  console.log((faults.length?'FAIL ':'PASS ')+scenario+' '+JSON.stringify(faults));
 }
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const source='src/pages/parish/MatrimonioSentarRegistrosPage.jsx';
const result={protocol:'V205',scope:'Actual React marriage seating page; in-memory fictitious services; no authenticated production E2E or physical network fault',sourceSha256:createHash('sha256').update(fs.readFileSync(source,'utf8').replace(/\r\n/g,'\n')).digest('hex'),date:new Date().toISOString(),rows,passed:rows.filter(x=>x.passed).length,total:rows.length,exceptions,externalRequests};
fs.writeFileSync(baseline?'AUDITORIA_RECUPERACION_UI_BASELINE_V205.json':'AUDITORIA_RECUPERACION_UI_V205.json',JSON.stringify(result,null,2)+'\n');
console.log('V205_BROWSER '+result.passed+'/'+result.total+' exceptions='+exceptions.length+' external='+externalRequests.length);
if(result.passed!==8||exceptions.length||externalRequests.length)process.exitCode=1;
