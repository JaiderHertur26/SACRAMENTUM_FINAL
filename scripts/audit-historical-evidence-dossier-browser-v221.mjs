// Actual Chancery React review page, fake RPC and jurisdiction; isolated Chrome, no credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('Chrome not available');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v218-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v218-review/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4882/')).ok}catch{}if(ready)break;await sleep(120)}
 if(!ready)throw Error('Vite chancery review QA not ready');
 browser=spawn(chrome,[...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),'--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:'ignore'});
 const portfile=path.join(tmp,'DevToolsActivePort');for(let i=0;i<130&&!fs.existsSync(portfile);i++)await sleep(100);if(!fs.existsSync(portfile))throw Error('Chrome missing port');
 const port=fs.readFileSync(portfile,'utf8').split(/\r?\n/)[0],pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 let seq=0;const pending=new Map();
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve:r=>{clearTimeout(t);resolve(r)},reject:e=>{clearTimeout(t);reject(e)}});socket.send(JSON.stringify({id,method,params}))});
 socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
 if(m.id&&pending.has(m.id)){const h=pending.get(m.id);pending.delete(m.id);m.error?h.reject(Error(m.error.message)):h.resolve(m.result||{})}
 if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params?.exceptionDetails?.exception?.description?.slice(0,100)||'exception');
 if(m.method==='Fetch.requestPaused'){const id=m.params.requestId,url=m.params.request.url;url.startsWith('http://127.0.0.1:4882/')?call('Fetch.continueRequest',{requestId:id}).catch(()=>{}):(externalRequests.push('blocked'),call('Fetch.failRequest',{requestId:id,errorReason:'BlockedByClient'}).catch(()=>{}))}
 });
 const evaluate=async expression=>{const q=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(q.exceptionDetails)throw Error(q.exceptionDetails.exception?.description||q.exceptionDetails.text);return q.result?.value};
 const state=()=>evaluate("(()=>({text:(document.querySelector('#root')?.innerText||'').slice(0,14000),ready:typeof window.__qa218?.changeUser==='function',cases:document.querySelectorAll('article').length,buttons:[...document.querySelectorAll('button')].map(b=>({text:b.innerText.trim(),disabled:b.disabled})),toasts:window.__qa218?.toasts?.map(x=>x.title),saved:window.__qa218?.saved?.length,calls:window.__qa218?.calls?.map(x=>x.name),role:window.__qa218?.user?.role}))()");
 const wait=async(pred,label)=>{let s;for(let i=0;i<110;i++){s=await state();if(pred(s))return s;await sleep(80)}throw Error('Timeout '+label+' '+JSON.stringify(s).slice(0,350)+' EXCEPTIONS='+JSON.stringify(exceptions)+' EXTERNAL='+externalRequests.length)};
 const test=async(label,run,assertion)=>{let error='';try{await run();const x=await state();if(!assertion(x))throw Error('wrong state '+JSON.stringify(x).slice(0,280));}catch(e){error=String(e.message).slice(0,350)}rows.push({label,passed:!error,error});console.log((error?'FAIL ':'PASS ')+label+' '+error)};
 const click=(label)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.click();return true})()");
 const input=value=>evaluate("(()=>{const q=document.querySelector('input[placeholder]');if(!q)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(q,"+JSON.stringify(value)+");q.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
 const select=value=>evaluate("(()=>{const q=document.querySelector('select');if(!q)return false;q.value="+JSON.stringify(value)+";q.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await call('Page.navigate',{url:'http://127.0.0.1:4882/'});
 await wait(s=>s.ready&&s.cases===50,'initial fifty historical cases');
 await test('chancery_has_real_react_queue_and_scoped_totals',async()=>{},s=>s.cases===50&&s.text.includes('219')&&s.text.includes('46')&&s.text.includes('173'));
 await test('diagnostic_classification_displays_all_219_cases',async()=>{
   await wait(s=>s.text.includes('Coincidencia integral')&&s.text.includes('Conflicto de identidad')&&s.text.includes('Sin partida coincidente'),'V219 triage');
   const info=await evaluate("(()=>{const names=[...document.querySelectorAll('article')].map(x=>x.innerText);return {strong:names.filter(x=>x.includes('Candidato coincidente:')).length,conflict:names.filter(x=>x.includes('Conflicto: coinciden')).length,missing:names.filter(x=>x.includes('Sin coincidencia física')).length}})()");
   if(info.strong!==46||info.conflict!==1||info.missing!==3)throw Error('V219 unexpected classifications '+JSON.stringify(info));
 },s=>s.calls.includes('assess_unresolved_legacy_links_v219')&&s.calls.includes('summarize_unresolved_legacy_candidates_v219'));
 await test('printed_workpaper_isolated_to_visible_case_and_non_official',async()=>{
   await evaluate("(()=>{window.__printQA={html:[],times:0};window.open=()=>({opener:null,document:{open(){},write(s){window.__printQA.html.push(s)},close(){}},focus(){},print(){window.__printQA.times++}});return true})()");
   if(!(await click('Imprimir ficha de cotejo')))throw Error('missing print button');
   const p=await evaluate("(()=>({times:window.__printQA.times,count:window.__printQA.html.length,content:window.__printQA.html[0]?.slice(0,22000)||''}))()");
   if(p.times!==1||p.count!==1||!p.content.includes('DOCUMENTO PRELIMINAR DE COTEJO')||!p.content.includes('Ficha preliminar de cotejo histórico')||!p.content.includes('No se han escrito datos en el registro'))throw Error('print dossier did not carry required provenance and safeguards: '+JSON.stringify({times:p.times,count:p.count}));
 },s=>s.calls.every(x=>x!=='update'&&x!=='insert'));
 await test('blocked_print_popup_fails_safely_and_does_not_mutate_case',async()=>{
   await evaluate("window.open=()=>null");
   if(!(await click('Imprimir ficha de cotejo')))throw Error('missing print button');
   await wait(s=>s.toasts.includes('Ventana de impresión bloqueada'),'popup blocked toast');
   const p=await evaluate("({prints:window.__printQA.times,copies:window.__printQA.html.length})");
   if(p.prints!==1||p.copies!==1)throw Error('unexpected extra print attempt');
 },s=>s.saved===0&&!s.calls.includes('record_unresolved_legacy_link_review_v218'));
 await test('missing_evidence_never_calls_write_rpc',async()=>{
   await input('NO');await click('Guardar constancia');await wait(s=>s.toasts.includes('Referencia documental incompleta'),'validation');
 },s=>s.saved===0&&!s.calls.includes('record_unresolved_legacy_link_review_v218'));
 await test('chancery_writes_document_reference_without_relinking',async()=>{
   await select('source_verified');
   await input('QA ARCHIVO PARROQUIAL V218 LIBRO PRUEBA');
   await click('Guardar constancia');await wait(s=>s.saved===1,'first audit event');
   await wait(s=>s.toasts.includes('Constancia registrada'),'audit toast');
 },s=>s.saved===1&&s.toasts.includes('Constancia registrada')&&s.calls.includes('record_unresolved_legacy_link_review_v218'));
 await test('pagination_covers_exactly_219_entries',async()=>{
   await click('Siguiente');await wait(s=>s.cases===50&&s.text.includes('Página 2'),'second');
   await click('Siguiente');await wait(s=>s.cases===50&&s.text.includes('Página 3'),'third');
   await click('Siguiente');await wait(s=>s.cases===50&&s.text.includes('Página 4'),'fourth');
   await click('Siguiente');await wait(s=>s.cases===19&&s.text.includes('Página 5'),'fifth');
 },s=>s.cases===19&&s.buttons.some(b=>b.text==='Siguiente'&&b.disabled));
 await test('parish_session_change_erases_chancery_case_data',async()=>{
   await evaluate("window.__qa218.changeUser({id:'qa-parish',role:'parish',dioceseId:'diocese-A'})");
   await wait(s=>s.role==='parish'&&s.cases===0&&s.text.includes('exclusiva del rol Cancillería'),'parish denied');
 },s=>s.cases===0&&!s.text.includes('QA-KEY-')&&!s.text.includes('219'));
 await test('non_chancery_role_has_no_case_print_action',async()=>{
   const p=await evaluate("(()=>({visible:[...document.querySelectorAll('button')].filter(b=>b.innerText.includes('Imprimir ficha de cotejo')).length,printed:window.__printQA.times}))()");
   if(p.visible!==0||p.printed!==1)throw Error('print action leaked on foreign session: '+JSON.stringify(p));
 },s=>s.role==='parish'&&s.cases===0);
 await test('second_diocese_cannot_see_previous_institution_cases',async()=>{
   await evaluate("window.__qa218.changeUser({id:'qa-chancery-other',role:'chancery',dioceseId:'diocese-B'})");
   await wait(s=>s.role==='chancery'&&s.cases===0&&!s.text.includes('219'),'foreign scoped');
 },s=>s.cases===0&&!s.text.includes('QA-KEY-'));
 await test('return_to_original_chancery_restores_authorized_data',async()=>{
   await evaluate("window.__qa218.changeUser({id:'qa-chancery',role:'chancery',dioceseId:'diocese-A'})");
   await wait(s=>s.cases===50&&s.text.includes('219'),'scope restored');
 },s=>s.cases===50&&s.text.includes('219'));
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const report={protocol:'V221',scope:'Actual Chancery HistoricalLinkReviewPage in Chromium; fake JWT/diocese/RPC, zero Supabase access',date:new Date().toISOString(),rows,passed:rows.filter(x=>x.passed).length,total:rows.length,jsExceptions:exceptions.length,blockedExternalRequests:externalRequests.length};
fs.writeFileSync('AUDITORIA_FICHAS_COTEJO_BROWSER_V221.json',JSON.stringify(report,null,2)+'\n');
console.log('V221_BROWSER '+report.passed+'/'+report.total+' JS='+exceptions.length+' external='+externalRequests.length);
if(report.passed!==report.total||exceptions.length||externalRequests.length)process.exitCode=1;
