// V211: real React components in isolated Chromium, all records/services fictional. No Supabase credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);
if(!chrome)throw Error('Chromium unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v211-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v211-details/vite.config.mjs'],{windowsHide:true,stdio:'ignore'});
let browser,socket;const exceptions=[],requests=[],results=[];
try{
 let isReady=false;for(let i=0;i<100;i++){try{isReady=(await fetch('http://127.0.0.1:4861/')).ok}catch{}if(isReady)break;await sleep(100)}
 if(!isReady)throw Error('Vite QA fixture unavailable');
 browser=spawn(chrome,[...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),'--headless=new','--disable-gpu','--disable-background-networking','--disable-extensions','--no-first-run','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:'ignore'});
 let portfile=path.join(tmp,'DevToolsActivePort');
 for(let i=0;i<150&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Chrome debugging unavailable');
 const port=fs.readFileSync(portfile,'utf8').split(/\r?\n/)[0];
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 const pending=new Map();let seq=0;
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve:r=>{clearTimeout(timeout);resolve(r)},reject:e=>{clearTimeout(timeout);reject(e)}});socket.send(JSON.stringify({id,method,params}))});
 socket.addEventListener('message',event=>{let obj;try{obj=JSON.parse(event.data)}catch{return}
  if(obj.id&&pending.has(obj.id)){const h=pending.get(obj.id);pending.delete(obj.id);obj.error?h.reject(Error(obj.error.message)):h.resolve(obj.result||{})}
  if(obj.method==='Runtime.exceptionThrown')exceptions.push(obj.params?.exceptionDetails?.exception?.description?.slice(0,170)||'browser exception');
  if(obj.method==='Fetch.requestPaused'){const url=obj.params.request.url;
   if(!url.startsWith('http://127.0.0.1:4861/')){requests.push('blocked external');call('Fetch.failRequest',{requestId:obj.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:obj.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const x=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);return x.result?.value};
 const state=()=>evaluate("(()=>({path:location.pathname,text:(document.querySelector('#root')?.innerText||'').slice(0,9000),ready:!!window.__qa211?.navigate,buttons:[...document.querySelectorAll('button')].map(x=>x.innerText.trim()),popups:window.__qa211?.popups,popupHtml:window.__qa211?.popupHtml?.slice(0,15000),toasts:window.__qa211?.toasts?.length,calls:window.__qa211?.calls?.length}))()");
 const wait=async(fn,label)=>{let s;for(let i=0;i<120;i++){s=await state();if(fn(s))return s;await sleep(90)}throw Error('Timeout '+label+' '+JSON.stringify({path:s?.path,buttons:s?.buttons,text:s?.text?.slice(0,250)}))};
 const check=async(label,action,validate)=>{const old=exceptions.length;let failure='';let info=null;
  try{await action();await sleep(80);info=await state();if(exceptions.length!==old)throw Error('JavaScript exception');if(!validate(info))throw Error('Expected UI state absent');}
  catch(e){failure=String(e.message).slice(0,350)}
  results.push({label,pass:!failure,failure});console.log((failure?'FAIL ':'PASS ')+label+' '+failure);
 };
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:"window.open=function(){window.__qa211.popups++;return{document:{open(){},write(s){window.__qa211.popupHtml+=s},close(){}},focus(){},close(){}}};window.print=()=>{window.__qa211.printed++}"});
 await call('Page.navigate',{url:'http://127.0.0.1:4861/parish/decrees/doc-current'});
 await wait(s=>s.ready&&s.text.includes('QA-V211-ACTUAL'),'initial documentary render');
 await check('decree_current_view',async()=>await wait(s=>s.text.includes('QA-V211-ACTUAL')) ,s=>s.text.includes('PERSONA FICTICIA ACTUAL')&&s.buttons.some(x=>x.includes('Imprimir decreto')));
 await check('decree_document_print',async()=>{await evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Imprimir decreto'));if(!b)throw Error('button');b.click()})()");await wait(s=>s.popups>0&&s.popupHtml?.length>500,'decree print')},s=>s.popupHtml.includes('QA-V211-ACTUAL')&&!s.popupHtml.includes('QA-FOREIGN-NEVER-VISIBLE'));
 await check('decree_historical_view',async()=>{await evaluate("window.__qa211.navigate('/parish/decrees/doc-historical')");await wait(s=>s.text.includes('QA-V211-HISTORICO'),'historical')},s=>s.text.includes('Antecedente histórico')&&s.text.includes('LIBRO QA 9')&&!s.text.includes('PERSONA FICTICIA ACTUAL'));
 await check('decree_foreign_denied',async()=>{await evaluate("window.__qa211.navigate('/parish/decrees/doc-foreign')");await wait(s=>s.text.includes('Decreto no disponible'),'foreign denied')},s=>!s.text.includes('QA-FOREIGN-NEVER-VISIBLE')&&!s.text.includes('NO MOSTRAR PERSONA EXTERNA')&&!s.buttons.includes('Imprimir decreto'));
 await check('decree_network_error_not_stuck',async()=>{await evaluate("window.__qa211.navigate('/parish/decrees/doc-error')");await wait(s=>s.text.includes('Volver a intentar'),'network error')},s=>s.text.includes('No se pudo consultar el decreto')&&!s.text.includes('PRIVATE INTERNAL DB ERROR')&&!s.text.includes('QA-V211-ACTUAL'));
 await check('decree_retry_recovers',async()=>{await evaluate("window.__qa211.scenario='recovered';[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Volver a intentar')).click()");await wait(s=>s.text.includes('QA-V211-RECUPERADO'),'retry')},s=>s.text.includes('PERSONA FICTICIA ACTUAL')&&s.buttons.some(x=>x.includes('Imprimir decreto')));
 await check('decree_trace_rpc_error_nonblocking',async()=>{await evaluate("window.__qa211.navigate('/parish/decrees/doc-rpc-error')");await wait(s=>s.text.includes('QA-V211-RECUPERADO'),'rpc exception')},s=>s.text.includes('PERSONA FICTICIA ACTUAL')&&!s.text.includes('PRIVATE RPC ERROR'));
 await check('decree_trace_rpc_never_resolves_but_document_opens',async()=>{await evaluate("window.__qa211.navigate('/parish/decrees/doc-rpc-hang')");await wait(s=>s.text.includes('QA-V211-RECUPERADO'),'rpc pending')},s=>s.text.includes('PERSONA FICTICIA ACTUAL')&&s.buttons.some(x=>x.includes('Imprimir decreto')));
 await check('decree_stale_response_isolation',async()=>{await evaluate("window.__qa211.navigate('/parish/decrees/doc-delayed')");await sleep(70);await evaluate("window.__qa211.navigate('/parish/decrees/doc-current')");await wait(s=>s.text.includes('QA-V211-ACTUAL'),'new decree');await sleep(850)},s=>s.text.includes('QA-V211-ACTUAL')&&!s.text.includes('QA-STALE-OLD'));
 await check('decree_cross_parish_scope_change',async()=>{await evaluate("window.__qa211.setParish('parish-other')");await wait(s=>s.text.includes('Decreto no disponible'),'changed parish')},s=>!s.text.includes('QA-V211-ACTUAL')&&s.text.includes('No existe o no pertenece'));
 await check('baptism_scope_positive',async()=>{await evaluate("window.__qa211.setParish('parish-one');window.__qa211.navigate('/parroquia/bautismo/baptism-current')");await wait(s=>s.text.includes('FICTICIA V211'),'baptism')},s=>s.text.includes('31')&&s.buttons.some(x=>x.includes('Imprimir partida')));
 await check('baptism_modal_preview',async()=>{await evaluate("(()=>{let b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Imprimir partida'));b.click()})()");await wait(s=>s.text.includes('PARTIDA FICTICIA LISTA PARA IMPRIMIR'),'baptism modal')},s=>s.text.includes('FICTICIA V211')&&s.text.includes('PARTIDA FICTICIA'));
 await check('baptism_foreign_denied',async()=>{await evaluate("window.__qa211.navigate('/parroquia/bautismo/baptism-foreign')");await wait(s=>s.text.includes('Partida no disponible'),'other parish')},s=>!s.text.includes('DATO EXTERNO')&&!s.buttons.some(x=>x.includes('Imprimir partida')));
 await check('baptism_stale_response_isolation',async()=>{await evaluate("window.__qa211.navigate('/parroquia/bautismo/baptism-delayed')");await sleep(70);await evaluate("window.__qa211.navigate('/parroquia/bautismo/baptism-current')");await wait(s=>s.text.includes('FICTICIA V211'),'fresh baptism');await sleep(850)},s=>!s.text.includes('VIEJO')&&s.text.includes('FICTICIA V211'));
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const report={protocol:'V211',scope:'Real React detail components in isolated Chromium. 100% fictional in-memory RPC and tables, zero credentials, no writes to real Supabase, simulated popup HTML.',timestamp:new Date().toISOString(),total:results.length,passed:results.filter(x=>x.pass).length,rows:results,jsExceptionCount:exceptions.length,externalRequestCount:requests.length};
fs.writeFileSync('AUDITORIA_DOCUMENTOS_BROWSER_V211.json',JSON.stringify(report,null,2)+'\n');
console.log('V211_BROWSER '+report.passed+'/'+report.total+' jsExceptions='+report.jsExceptionCount);
if(report.passed!==report.total||exceptions.length||requests.length)process.exitCode=1;
