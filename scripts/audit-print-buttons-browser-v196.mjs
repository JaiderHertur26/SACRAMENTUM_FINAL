// V196 actual React modal and funeral page click audit; all records fictitious.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v196-'));
const browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:'ignore'});
let socket;const rows=[],exceptions=[];
try{
 const portfile=path.join(tmp,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Browser not ready');
 const [port]=fs.readFileSync(portfile,'utf8').trim().split(/\r?\n/);
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 const pending=new Map();let seq=0;
 socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return;}
  if(m.id&&pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);m.error?cb.reject(Error(m.error.message)):cb.resolve(m.result||{});}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params?.exceptionDetails?.exception?.description||'JS runtime exception');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result?.value;
 };
 await call('Page.enable');await call('Runtime.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:"window.print=function(){try{window.parent.__qa196.printed++}catch{}};window.open=function(){var q=window.__qa196;q.popups++;return {document:{write:function(s){q.popupHtml+=s},close:function(){}},close:function(){q.popupClosed++},focus:function(){}}};"});
 for(const kind of (process.argv.includes('--funeral-only')?['exequias']:['bautismo','confirmacion','matrimonio','exequias'])){
  const exBefore=exceptions.length;
  await call('Page.navigate',{url:'http://127.0.0.1:4846/?type='+kind});
  let state;
  for(let i=0;i<85;i++){
   await sleep(130);
   state=await evaluate("(()=>({ready:!!window.__qa196,text:document.querySelector('#root')?.innerText?.slice(0,1700)||'',buttons:[...document.querySelectorAll('button')].map(b=>b.innerText.trim())}))()");
   if(state.ready&&state.buttons.some(x=>kind==='exequias'?x==='Ver':x.toLowerCase().includes('imprimir partida')))break;
  }
  if(!state.ready)throw Error(kind+' could not render '+JSON.stringify(state).slice(0,750));
  if(kind==='exequias'){
   await evaluate("(()=>{let b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Ver');if(!b)return false;b.click();return true})()");
   for(let i=0;i<40;i++){await sleep(80);if(await evaluate("!![...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Imprimir Partida')"))break;}
  }
  const label=kind==='bautismo'?'imprimir partida oficial':kind==='confirmacion'?'imprimir acta':'imprimir partida';
  const expr="(()=>{let b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().toLowerCase().includes('"+label+"'));if(!b)return false;b.click();return true})()";
  await evaluate("window.__qa196.deny=true;true");
  if(!await evaluate(expr))throw Error(kind+' no print button; '+JSON.stringify(await evaluate("(()=>({buttons:[...document.querySelectorAll('button')].map(b=>b.innerText.trim()),text:document.querySelector('#root')?.innerText?.slice(0,800)}))()")));
  await sleep(850);
  const denied=await evaluate("(()=>{let q=window.__qa196;return {calls:q.registerCalls.length,first:q.registerCalls[0],printed:q.printed,popups:q.popups,popupClosed:q.popupClosed,toasts:q.toasts.map(t=>t.title)}})()");
  await evaluate("window.__qa196.deny=false;true");
  if(!await evaluate(expr))throw Error(kind+' no valid print button');
  let allowed;
  for(let i=0;i<38;i++){
   await sleep(100);
   allowed=await evaluate("(()=>{let q=window.__qa196;let f=document.querySelector('iframe');return {calls:q.registerCalls.length,last:q.registerCalls.at(-1),printed:q.printed,popups:q.popups,popupClosed:q.popupClosed,popupHtml:q.popupHtml.slice(0,20000),frameText:f?.contentDocument?.body?.innerText?.slice(0,9000)||''}})()");
   if(allowed.calls>=2&&(kind==='exequias'?allowed.popupHtml.length>1000:allowed.frameText.length>100))break;
  }
  await sleep(820);
  allowed.printed=await evaluate('window.__qa196.printed');
  const content=(allowed.frameText||allowed.popupHtml).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const faults=[];
  if(denied.calls!==1||denied.first?.kind!==kind)faults.push('denial audit call missing');
  if(denied.printed!==0||(kind==='exequias'&&denied.popupClosed!==1))faults.push('denied print was not stopped');
  if(denied.toasts.length===0)faults.push('missing error toast');
  if(allowed.calls!==2||allowed.last?.kind!==kind)faults.push('success audit call missing');
  if(kind!=='exequias'&&allowed.printed!==1)faults.push('browser print not invoked exactly once');
  if(kind==='exequias'&&(!allowed.popups||allowed.popupHtml.length<1000))faults.push('funeral printable popup missing');
  if(!allowed.last?.hasHtml||allowed.last?.book!=='31'||allowed.last?.folio!=='442'||allowed.last?.number!=='888'||!allowed.last?.recordUpdated)faults.push('wrong metadata');
  if(!content.includes('31')||!content.includes('442')||!content.includes('888'))faults.push('canonical document not found');
  if(content.includes('9999')||content.includes('9998')||content.includes('9997'))faults.push('historical mismatches leaked');
  if(exceptions.length!==exBefore)faults.push('runtime exception');
  const row={kind,passed:faults.length===0,faults,
   denied:{calls:denied.calls,printed:denied.printed,popupClosed:denied.popupClosed,toasts:denied.toasts.length},
   allowed:{calls:allowed.calls,printed:allowed.printed,popups:allowed.popups,htmlLength:content.length,
    book:allowed.last?.book,folio:allowed.last?.folio,number:allowed.last?.number,hasHtml:allowed.last?.hasHtml}};
  rows.push(row);
  console.log((row.passed?'PASS':'FAIL')+' '+kind+' '+JSON.stringify(row).slice(0,1300));
 }
}finally{try{socket?.close()}catch{}try{browser.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const result={protocol:'V196',scope:'REAL React modal buttons, fake data/services, NO authenticated Supabase session or physical printer',rows,
 passed:rows.filter(r=>r.passed).length,total:4,exceptions:exceptions.slice(0,12),date:new Date().toISOString()};
fs.writeFileSync('AUDITORIA_BOTONES_IMPRESION_V196.json',JSON.stringify(result,null,2)+'\n');
console.log('V196_BROWSER '+result.passed+'/4');
if(result.passed!==4)process.exitCode=1;
