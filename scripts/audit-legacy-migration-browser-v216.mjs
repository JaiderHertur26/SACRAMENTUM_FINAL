// Real migration page, fake file/RPC/directory, isolated Chromium. No Supabase credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('Chrome not available');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v212-')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v212-migration/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4862/')).ok}catch{}if(ready)break;await sleep(120)}
 if(!ready)throw Error('Vite migration QA not ready');
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
 if(m.method==='Fetch.requestPaused'){const id=m.params.requestId,url=m.params.request.url;url.startsWith('http://127.0.0.1:4862/')?call('Fetch.continueRequest',{requestId:id}).catch(()=>{}):(externalRequests.push('blocked'),call('Fetch.failRequest',{requestId:id,errorReason:'BlockedByClient'}).catch(()=>{}))}
 });
 const evaluate=async expression=>{const q=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(q.exceptionDetails)throw Error(q.exceptionDetails.exception?.description||q.exceptionDetails.text);return q.result?.value};
 const state=()=>evaluate("(()=>({text:(document.querySelector('#root')?.innerText||'').slice(0,4500),ready:!!window.__qa212?.setRole,profiles:document.querySelectorAll('select')[0]?.value,parish:document.querySelectorAll('select')[1]?.value,options:[...(document.querySelectorAll('select')[1]?.options||[])].map(x=>x.value),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.innerText.trim(),disabled:b.disabled})),created:window.__qa212?.created.length,lastCreated:window.__qa212?.created.at(-1),staged:window.__qa212?.staged.length,applied:window.__qa212?.applied.length,toasts:window.__qa212?.toasts?.map(x=>x.title)}))()");
 const wait=async(pred,label)=>{let s;for(let i=0;i<110;i++){s=await state();if(pred(s))return s;await sleep(80)}throw Error('Timeout '+label+' '+JSON.stringify(s).slice(0,350)+' EXCEPTIONS='+JSON.stringify(exceptions)+' EXTERNAL='+externalRequests.length)};
 const test=async(label,run,assertion)=>{let error='';try{await run();const x=await state();if(!assertion(x))throw Error('wrong state '+JSON.stringify(x).slice(0,280));}catch(e){error=String(e.message).slice(0,350)}rows.push({label,passed:!error,error});console.log((error?'FAIL ':'PASS ')+label+' '+error)};
 const select=(index,value)=>evaluate("(()=>{const q=document.querySelectorAll('select')["+index+"];q.value="+JSON.stringify(value)+";q.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
 const click=(label)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.click();return true})()");
 const file=(name,rows)=>evaluate("(()=>{const q=new File([JSON.stringify({data:"+JSON.stringify(rows)+"})],"+JSON.stringify(name)+",{type:'application/json'});const e=document.querySelector('input[type=file]');Object.defineProperty(e,'files',{configurable:true,value:[q]});e.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await call('Page.navigate',{url:'http://127.0.0.1:4862/'});
 await wait(s=>s.ready&&s.options.includes('parish-A'),'initial load');
 await test('diocese_sees_only_own_parishes',async()=>{},s=>s.options.includes('parish-A')&&!s.options.includes('parish-B'));
 await test('known_baptism_file_auto_analyzed',async()=>{await file('BAUTIZOS.json',[{libro:31,folio:442,numero:888,fecbau:'2026-01-01',nombres:'QA',apellidos:'FICTICIA'}]);await wait(s=>s.profiles==='BAUTIZOS'&&s.text.includes('Vista previa de normalización'),'analyze')},s=>s.text.includes('Crear staging')&&s.created===0);
 await test('profile_change_blocks_staging',async()=>{await select(0,'CONFIRMA');await wait(s=>s.text.includes('El perfil seleccionado cambió'),'mismatch')},s=>s.buttons.some(b=>b.text.includes('Crear staging')&&b.disabled)&&s.created===0);
 await test('reanalyze_then_stage_allowed',async()=>{await click('Reanalizar con este perfil');await select(1,'parish-A');await wait(s=>s.parish==='parish-A','parish');await click('Crear staging');await wait(s=>s.created===1&&s.staged===1,'stage')},s=>s.created===1&&s.text.includes('Staging listo')&&!s.text.includes('El perfil seleccionado cambió'));
 await test('changing_parish_invalidates_staged_batch',async()=>{await select(1,'');await sleep(50)},s=>!s.text.includes('Staging listo')&&s.applied===0);
 await test('manual_profile_for_unknown_filename',async()=>{await file('ARCHIVO-DESCONOCIDO.json',[{libro:1,folio:2,numero:3,nombres:'QA'}]);await wait(s=>s.text.includes('No se reconoció el perfil automáticamente'),'manual prompt');await select(0,'BAUTIZOS');await click('Reanalizar con este perfil');await wait(s=>s.profiles==='BAUTIZOS'&&s.text.includes('Vista previa de normalización'),'manual analyzed')},s=>s.created===1&&!s.text.includes('El perfil seleccionado cambió'));
 await test('stalled_import_is_never_announced_as_success',async()=>{await select(1,'parish-A');await click('Crear staging');await wait(s=>s.created===2,'second stage');await evaluate("window.__qa212.scenario='stalled'");await click('Importar únicamente válidos');await wait(s=>s.applied===1,'stalled');await sleep(100)},s=>s.toasts.some(x=>x.includes('Importación parcial'))&&!s.toasts.some(x=>x==='Importación aplicada'));
 await test('switching_diocesan_scope_invalidates_batch_and_options',async()=>{await evaluate("window.__qa212.setRole('diocese',null)");await wait(s=>s.options.length===1,'unscoped cleared')},s=>!s.text.includes('Staging listo')&&s.options.length===1);
 await test('general_admin_can_select_another_parish',async()=>{await evaluate("window.__qa212.setRole('admin_general',null)");await wait(s=>s.options.includes('parish-B'),'admin scope')},s=>s.options.includes('parish-A')&&s.options.includes('parish-B'));
 await test('last_selected_file_wins_async_race',async()=>{await file('BAUTIZOS-slow.json',[{libro:1,folio:2,numero:3,fecbau:'2020-01-01'}]);await sleep(30);await file('CONFIRMA-fast.json',[{libro:1,folio:2,numero:3,feccon:'2020-01-01'}]);await wait(s=>s.profiles==='CONFIRMA'&&s.text.includes('CONFIRMA-fast.json'),'fast file');await sleep(500)},s=>s.profiles==='CONFIRMA'&&s.text.includes('CONFIRMA-fast.json')&&!s.text.includes('BAUTIZOS-slow.json'));
 await test('general_admin_batch_is_bound_to_selected_foreign_diocese',async()=>{await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===3,'admin staging')},s=>s.lastCreated?.parishId==='parish-B'&&s.lastCreated?.dioceseId==='diocese-B');
 await test('reported_reconciliation_success_is_separated_from_pending_creations',async()=>{
  await evaluate("window.__qa212.scenario='normal'");
  await file('INSBAUTI.json',[{numero:'000101',nombres:'QA',apellidos:'FICTICIA',reported:0}]);
  await wait(s=>s.profiles==='INSBAUTI','boleta baptism');
  await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===4,'boleta batch');
  await click('Importar todas las boletas');await wait(s=>s.applied===2,'boleta applied');
 },s=>s.toasts.includes('Boletas históricas procesadas')&&!s.toasts.includes('Importación aplicada'));
 await test('reported_identity_review_is_not_misrepresented_as_success',async()=>{
  await file('INSCONFI.json',[{numero:'000102',nombres:'QA',apellidos:'FICTICIA',reported:1}]);
  await wait(s=>s.profiles==='INSCONFI','confirmation boleta');
  await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===5,'confirmation batch');
  await evaluate("window.__qa212.scenario='reported-review'");
  await click('Importar todas las boletas');await wait(s=>s.applied===3,'review');
 },s=>s.toasts.includes('Boletas procesadas · revisión pendiente'));

 await test('marriage_preinscription_success_shows_own_counts',async()=>{
  await evaluate("window.__qa212.scenario='normal'");
  await file('INSMATRI.json',[{numero:'000201',nombres1:'QA',apellidos1:'FICTICIO',nombres2:'QB',apellidos2:'FICTICIA',fecmat:'2026-10-01',reported:0}]);
  await wait(s=>s.profiles==='INSMATRI','marriage profile');
  await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===6,'marriage stage');
  await click('Importar únicamente válidos');await wait(s=>s.applied===4,'marriage applied');
 },s=>s.toasts.includes('Preinscripciones matrimoniales procesadas')&&!s.toasts.includes('Importación aplicada'));
 await test('reported_marriage_missing_identity_requires_manual_review',async()=>{
  await file('INSMATRI (2).json',[{numero:'000202',nombres1:'QA',apellidos1:'FICTICIO',nombres2:'QB',apellidos2:'FICTICIA',fecmat:'2026-10-01',reported:1}]);
  await wait(s=>s.profiles==='INSMATRI'&&s.text.includes('INSMATRI (2).json'),'marriage review profile');
  await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===7,'marriage review stage');
  await evaluate("window.__qa212.scenario='reported-review'");
  await click('Importar únicamente válidos');await wait(s=>s.applied===5,'marriage review result');
 },s=>s.toasts.includes('Matrimonios históricos · revisión pendiente'));
 await test('historical_marginal_note_import_shows_note_specific_summary',async()=>{
   await evaluate("window.__qa212.scenario='normal'");
   await file('NTBAU002.json',[{libro:'9216',folio:'1',numero:'1',nota:'QA216 nota completamente ficticia',dafe:'QA'}]);
   await wait(s=>s.profiles==='NTBAU002','historical note');
   await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===8,'note stage');
   await click('Importar únicamente válidos');await wait(s=>s.applied===6,'note applied');
 },s=>s.toasts.includes('Notas marginales históricas vinculadas')&&!s.toasts.includes('Importación aplicada'));
 await test('historical_note_cross_parish_error_must_never_report_success',async()=>{
   await file('NTBAU002 (2).json',[{libro:'9216',folio:'1',numero:'1',nota:'QA216 nota con clave ajena',dafe:'QA'}]);
   await wait(s=>s.profiles==='NTBAU002'&&s.text.includes('NTBAU002 (2).json'),'note error file');
   await select(1,'parish-B');await click('Crear staging');await wait(s=>s.created===9,'note error stage');
   await evaluate("window.__qa212.scenario='note-error'");
   await click('Importar únicamente válidos');await wait(s=>s.applied===7,'note error applied');
 },s=>s.toasts.includes('Notas históricas · errores de importación')&&!s.toasts.includes('Importación aplicada'));
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const report={protocol:'V216',scope:'Actual LegacyMigrationCenterPage in Chromium; purely fictitious JSON input, fake identity/RPC, zero Supabase access',date:new Date().toISOString(),rows,passed:rows.filter(x=>x.passed).length,total:rows.length,jsExceptions:exceptions.length,blockedExternalRequests:externalRequests.length};
fs.writeFileSync('AUDITORIA_CENTRO_MIGRACION_BROWSER_V216.json',JSON.stringify(report,null,2)+'\n');
console.log('V216_BROWSER '+report.passed+'/'+report.total+' JS='+exceptions.length+' external='+externalRequests.length);
if(report.passed!==report.total||exceptions.length||externalRequests.length)process.exitCode=1;
