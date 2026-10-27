// V222: actual React pages in isolated Chromium, deterministic delayed mock services.
// No credentials, real Supabase calls, external network, or database writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v222-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v222-parish-session/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;
const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;
 for(let i=0;i<130;i++){try{ready=(await fetch('http://127.0.0.1:4886/')).ok}catch{}if(ready)break;await sleep(120)}
 if(!ready)throw Error('Vite V222 QA not ready');
 browser=spawn(chrome,[...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),'--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:'ignore'});
 const pf=path.join(tmp,'DevToolsActivePort');
 for(let i=0;i<130&&!fs.existsSync(pf);i++)await sleep(100);
 if(!fs.existsSync(pf))throw Error('Chrome missing remote debugging port');
 const port=fs.readFileSync(pf,'utf8').split(/\r?\n/)[0];
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 let seq=0;
 const pending=new Map();
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq,t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);
  pending.set(id,{resolve:r=>{clearTimeout(t);resolve(r)},reject:e=>{clearTimeout(t);reject(e)}});
  socket.send(JSON.stringify({id,method,params}));
 });
 socket.addEventListener('message',e=>{
  let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const h=pending.get(m.id);pending.delete(m.id);m.error?h.reject(Error(m.error.message)):h.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params?.exceptionDetails?.exception?.description?.slice(0,300)||'JS exception');
  if(m.method==='Fetch.requestPaused'){
   const id=m.params.requestId,url=m.params.request.url;
   if(url.startsWith('http://127.0.0.1:4886/'))call('Fetch.continueRequest',{requestId:id}).catch(()=>{});
   else {externalRequests.push('blocked');call('Fetch.failRequest',{requestId:id,errorReason:'BlockedByClient'}).catch(()=>{});}
  }
 });
 const evaluate=async expression=>{
  const q=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(q.exceptionDetails)throw Error(q.exceptionDetails.exception?.description||q.exceptionDetails.text);
  return q.result?.value;
 };
 const state=()=>evaluate("(()=>({text:(document.querySelector('#root')?.innerText||'').slice(0,14000),pending:window.__qa222?.pending?.map(p=>p.kind+':'+p.scopeId)||[],calls:window.__qa222?.calls||[],toasts:window.__qa222?.toasts?.map(t=>t.title)||[],modal:!!document.querySelector('[data-qa-modal]'),page:window.__qa222?.page}))()");
 const wait=async(predicate,label)=>{let s;for(let i=0;i<160;i++){s=await state();if(predicate(s))return s;await sleep(65)}throw Error('Timeout '+label+' '+JSON.stringify(s).slice(0,500))};
 const test=async(label,body)=>{
  let error='';
  try{await body()}catch(e){error=String(e?.stack||e).slice(0,500)}
  rows.push({label,passed:!error,error});
  console.log((error?'FAIL ':'PASS ')+label+(error?' '+error:''));
 };
 const act=x=>evaluate(x);
 await call('Page.enable');
 await call('Runtime.enable');
 await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await call('Page.navigate',{url:'http://127.0.0.1:4886/'});
 await test('sacramental_request_A_pending',async()=>{
  await wait(s=>s.pending.includes('sacr:parish-a'),'initial A fetch');
 });
 await test('switch_B_and_late_A_never_leaks_into_sacramental_inbox',async()=>{
  await act("window.__qa222.changeUser('b')");
  await wait(s=>s.pending.includes('sacr:parish-b'),'B fetch');
  await act("window.__qa222.resolve('sacr','parish-a',[{id:'notice-a',personName:'SECRETO PARROQUIA A',status:'sin_leer'}])");
  await sleep(150);
  const s=await state();
  if(s.text.includes('SECRETO PARROQUIA A'))throw Error('A private message leaked into B');
  await act("window.__qa222.resolve('sacr','parish-b',[{id:'notice-b',personName:'AVISO SOLO B',status:'leida'}])");
  await wait(s=>s.text.includes('AVISO SOLO B'),'B inbox');
 });
 await test('sacramental_modal_is_destroyed_when_user_changes',async()=>{
  // Click the actual aviso button, not the page refresh button.
  await act("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('AVISO SOLO B'));b?.click()})()");
  await wait(s=>s.modal,'B modal');
  await act("window.__qa222.changeUser('a')");
  const s=await wait(s=>s.pending.includes('sacr:parish-a'),'new A request');
  if(s.modal||s.text.includes('AVISO SOLO B'))throw Error('Prior B modal retained in A session');
 });
 await test('unauthorized_profile_denied_without_notification_reads',async()=>{
  await act("window.__qa222.changeUser({user:{id:'auth-b',role:'parish',parishId:'parish-b',dioceseId:'diocese-b'},profile:{id:'profile-b',auth_user_id:'auth-b',role:'parish',parish_id:'parish-b',diocese_id:'diocese-b',is_active:false,status:'SUSPENDED'}})");
  const s=await wait(s=>s.text.includes('sesión parroquial activa y verificada'),'suspended message');
  if(s.text.includes('AVISO SOLO B')||s.modal)throw Error('Forbidden content still visible');
 });
 await test('official_inbox_late_A_response_isolation',async()=>{
  await act("window.__qa222.setPage('official');window.__qa222.changeUser('a')");
  await wait(s=>s.pending.includes('official:parish-a'),'A official fetch');
  await act("window.__qa222.changeUser('b')");
  await wait(s=>s.pending.includes('official:parish-b'),'B official fetch');
  await act("window.__qa222.resolve('official','parish-a',[{id:'dec-a',message:'DECRETO PRIVADO SOLO A',createdAt:'2026-10-26',status:'pending'}])");
  await sleep(150);
  if((await state()).text.includes('DECRETO PRIVADO SOLO A'))throw Error('A decree leaked into B');
  await act("window.__qa222.resolve('official','parish-b',[{id:'dec-b',message:'DECRETO SOLO B',createdAt:'2026-10-26',status:'read'}])");
  await wait(s=>s.text.includes('DECRETO SOLO B'),'B official decree');
 });
 await test('confirmation_context_late_A_response_isolation',async()=>{
  await act("window.__qa222.setPage('confirmation');window.__qa222.changeUser('a')");
  await wait(s=>s.pending.includes('confirmation:parish-a'),'A confirmation');
  await act("window.__qa222.changeUser('b')");
  await wait(s=>s.pending.includes('confirmation:parish-b'),'B confirmation');
  await act("window.__qa222.resolve('confirmation','parish-a',{confirmations:[{id:'conf-a',nombres:'CONFIDENCIAL A'}],parishes:[{id:'parish-b',name:'Parroquia B'}]})");
  await sleep(150);
  if((await state()).text.includes('CONFIDENCIAL A'))throw Error('A confirmation record leaked');
  await act("window.__qa222.resolve('confirmation','parish-b',{confirmations:[{id:'conf-b',nombres:'CONFIRMADO B',book_number:2,folio:3,number:4}],parishes:[{id:'parish-a',name:'Parroquia A'},{id:'parish-b',name:'Parroquia B'}]})");
  await wait(s=>s.text.includes('CONFIRMADO B'),'B confirmation loaded');
 });
 await test('confirmation_send_requires_current_visible_source_and_destination',async()=>{
  await act("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Emitir notificación'));b?.click()})()");
  await wait(s=>s.toasts.includes('Referencia de origen o destino no autorizada'),'invalid send');
  const s=await state();
  if(s.calls.some(x=>x.type==='issue'))throw Error('Sent without current scoped confirmation');
 });
 await test('no_external_network_or_JS_exceptions',async()=>{
  if(exceptions.length||externalRequests.length)throw Error(JSON.stringify({exceptions,externalRequests}));
 });
}finally{
 try{socket?.close()}catch{}
 try{browser?.kill()}catch{}
 try{vite.kill()}catch{}
 try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}
}
const report={protocol:'V222',scope:'Three actual React parish correspondence pages in isolated Chromium; delayed mocks; zero Supabase access',date:new Date().toISOString(),rows,passed:rows.filter(r=>r.passed).length,total:rows.length,exceptions,externalRequests};
fs.writeFileSync('AUDITORIA_NOTIFICACIONES_SESIONES_BROWSER_V222.json',JSON.stringify(report,null,2)+'\n');
console.log('V222_BROWSER '+report.passed+'/'+report.total+' JS='+exceptions.length+' external='+externalRequests.length);
if(report.passed!==report.total||exceptions.length||externalRequests.length)process.exitCode=1;
