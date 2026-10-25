// Actual React page, in-memory fictitious services. NO authenticated production E2E.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v207-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v207-pending-creation/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:4857/')).ok}catch{}if(ready)break;await sleep(100)}if(!ready)throw Error('Vite unavailable');
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
   if(!url.startsWith('http://127.0.0.1:4857/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("(()=>{const q=window.__qa207;return {text:document.querySelector('#root')?.textContent||'',buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,disabled:b.disabled})),hasForm:!!document.querySelector('form'),calls:q?.calls.map(c=>({kind:c.p_kind,requestId:c.p_request_id,record:c.p_record})),reservations:q?.receipts.size,ids:q?.rows.map(r=>r.id),next:q?.next,reads:q?.reads,printed:q?.printed,toasts:q?.toasts,success:q?.toasts.some(t=>t.variant!=='destructive')}})()");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<100;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});


 const fill=async(name,value)=>evaluate("(()=>{const normalize=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();let el=document.querySelector('[name='+JSON.stringify("+JSON.stringify(name)+")+']');if(!el){const label=[...document.querySelectorAll('label')].find(l=>normalize(l.textContent).trim()===normalize("+JSON.stringify(name)+"));el=label?.parentElement.querySelector('input,select')}if(!el)return false;const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,"+JSON.stringify(value)+");el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
 const submit=async(kind,twice=true)=>kind==='exequias'?click('Guardar pendiente',twice):evaluate("(()=>{const f=document.querySelector('form');if(!f)return false;f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));"+(twice?"f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));":"")+"return true})()");
 const populate=async kind=>{
  const fields=kind==='matrimonio'?{novioNombres:'QA207 NOVIO',novioApellidos:'FICTICIO',novioFechaNac:'1990-01-01',novioEcclesialStatus:'catholic_baptized',fechaHoraPrevista:'2026-10-20T10:00'}:kind==='exequias'?{'Nombres':'QA207','Apellidos':'FICTICIO','Fecha de defunción':'2026-10-18'}:{nombres:'QA207',apellidos:'FICTICIO',fechaNacimiento:'2020-01-01',fechaSacramento:'2026-10-20',sexo:'MASCULINO'};
  for(const [name,value] of Object.entries(fields)){if(!await fill(name,value))throw Error('Missing field '+name);await sleep(30)}
  if(kind==='matrimonio'){
   if(!await click('Novia'))throw Error('Missing bride tab');await sleep(70);
   for(const [name,value] of Object.entries({noviaNombres:'QA207 NOVIA',noviaApellidos:'FICTICIA',noviaFechaNac:'1991-01-01',noviaEcclesialStatus:'catholic_baptized'})){if(!await fill(name,value))throw Error('Missing bride field '+name);await sleep(30)}
  }
  await sleep(80);
 };
 const definitions=['bautismo','confirmacion','matrimonio','exequias'].flatMap(kind=>['double-success','lost-response','reject-before-save','changed-after-commit',kind==='exequias'?'refresh-failure':'verify-read-failure'].map(scenario=>({kind,scenario})));
 definitions.push({kind:'exequias',scenario:'new-registration'});
 for(const {kind,scenario} of definitions){
  const faults=[];let first,final;
  const check=(condition,message)=>{if(!condition)faults.push(message)};
  try{
   await call('Page.navigate',{url:'http://127.0.0.1:4857/?kind='+kind+'&case='+scenario});
   await waitFor(s=>kind==='exequias'?s.text.includes('Nuevo registro'):s.hasForm,'initial form');await sleep(180);
   await populate(kind);
   if(!await submit(kind))throw Error('No submit action');
   const needsRetry=scenario==='lost-response'||scenario==='reject-before-save'||scenario==='changed-after-commit'||(scenario==='verify-read-failure'&&kind!=='matrimonio');
   if(needsRetry){
    first=await waitFor(s=>s.toasts?.some(t=>t.variant==='destructive'),'first failure');await sleep(120);
    check(first.calls.length===1,'double submit or automatic mutation replay');
    check(!first.success,'unverified draft presented as success');
    check(first.reservations===(scenario==='reject-before-save'?0:1),'wrong durable receipt count');
    check(first.printed===0,'failed creation printed a ticket');
    if(scenario==='changed-after-commit'){
     const field=kind==='matrimonio'?'noviaNombres':kind==='exequias'?'Nombres':'nombres';
     if(!await fill(field,'CHANGED QA207'))throw Error('Cannot edit after error');await sleep(50);
    }
    if(!await submit(kind))throw Error('Retry unavailable');
    if(scenario==='changed-after-commit'){
     final=await waitFor(s=>s.calls?.length===2&&s.toasts.filter(t=>t.variant==='destructive').length===2,'changed replay rejection');
     check(!final.success&&final.reservations===1,'changed request created second draft');
    }else{
     final=await waitFor(s=>s.success,'explicit retry success');
     check(final.reservations===1,'retry reserved twice');
    }
    check(final.calls.length===2&&final.calls[0].requestId===final.calls[1].requestId,'retry request ID changed');
   }else if(scenario==='refresh-failure'){
    first=await waitFor(s=>s.text.includes('No fue posible verificar'),'failed refresh');
    check(first.calls.length===1&&first.reservations===1,'refresh error duplicated creation');
    await evaluate('window.__qa207.failRefresh=false');await click('Reintentar sincronizaci');
    final=await waitFor(s=>s.text.includes('Pendientes (1)'),'refresh restored');
    check(final.calls.length===1,'read retry wrote another draft');
   }else{
    first=await waitFor(s=>s.success,'successful save');check(first.calls.length===1&&first.reservations===1,'double submit created two drafts');
    if(scenario==='new-registration'){
     await click('Nuevo registro');await sleep(70);await populate(kind);await submit(kind);
     final=await waitFor(s=>s.reservations===2&&s.toasts.filter(t=>t.variant!=='destructive').length===2,'second intentional creation');
     check(final.calls.length===2&&final.calls[0].requestId!==final.calls[1].requestId,'new form reused old request ID');
    }else final=first;
   }
   check(final.next===final.reservations+1,'registration counter mismatch');
   check(new Set(final.ids).size===final.reservations,'duplicate pending ID');
   check(final.calls.every(c=>/^[0-9a-f-]{36}$/i.test(c.requestId)),'missing UUID');
  }catch(error){faults.push(error.message)}
  const compact=s=>s?{calls:s.calls,reservations:s.reservations,ids:s.ids,next:s.next,reads:s.reads,printed:s.printed,success:s.success,toasts:s.toasts?.map(t=>({title:t.title,description:t.description})),text:s.text.slice(-500)}:null;
  rows.push({kind,scenario,passed:faults.length===0,faults,first:compact(first),final:compact(final)});
  console.log((faults.length?'FAIL ':'PASS ')+kind+'/'+scenario+' '+JSON.stringify(faults));
 }
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const files=['src/pages/parish/BaptismNewPage.jsx','src/pages/parish/ConfirmationNewPage.jsx','src/pages/parish/MatrimonioNewPage.jsx','src/pages/parish/FuneralRegistryPage.jsx','src/services/pendingCreationService.js','src/services/sacramentsService.js','src/services/marriagesCloudService.js','src/services/funeralService.js'];
const report={protocol:'V207',scope:'Actual React pages AND production service code, simulated Supabase client; no authenticated browser E2E',date:new Date().toISOString(),sourceSha256:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),rows,passed:rows.filter(r=>r.passed).length,total:rows.length,exceptions,externalRequests};
fs.writeFileSync('AUDITORIA_CREACION_BOLETAS_NAVEGADOR_V207.json',JSON.stringify(report,null,2)+'\n');
console.log('V207_BROWSER '+report.passed+'/'+report.total+' exceptions='+exceptions.length+' external='+externalRequests.length);
if(report.passed!==21||exceptions.length||externalRequests.length)process.exitCode=1;
