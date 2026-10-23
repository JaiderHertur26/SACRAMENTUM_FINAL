// V170 · Actual React reconciliation screen in isolated Chrome, fictional actors.
// Never communicates with Supabase or modifies ecclesiastical records.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v170-'));
const browser=spawn(chrome,['--headless=new','--no-first-run','--disable-gpu','--disable-extensions',
 '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const report={scope:'Real React page in Chrome with local fake profiles; no Supabase login, no PostgreSQL concurrency evidence.',steps:[],exceptions:[]};
let ws;
try{
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<90&&!fs.existsSync(portFile);i++)await sleep(100);
 if(!fs.existsSync(portFile))throw Error('Browser CDP unavailable');
 const [port]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(pages.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let seq=0;const awaiting=new Map();
 ws.addEventListener('message',event=>{
  let message;try{message=JSON.parse(event.data)}catch{return;}
  if(message.id&&awaiting.has(message.id)){
   const p=awaiting.get(message.id);awaiting.delete(message.id);
   message.error?p.reject(Error(message.error.message)):p.resolve(message.result||{});
  }
  if(message.method==='Runtime.exceptionThrown')
   report.exceptions.push(message.params?.exceptionDetails?.text||'JS error');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;awaiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
 });
 const js=async expression=>{
  const x=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);
  return x.result?.value;
 };
 const state=()=>js(`(()=>{const text=document.querySelector('#root')?.innerText||'';
 const count=label=>{const p=text.indexOf(label);if(p<0)return null;
 return Number(text.slice(p+label.length).trim().match(/^\\d+/)?.[0]??-1)};
 return {articles:document.querySelectorAll('article').length,
 pending:count('Pendientes de aprobación'),authorized:count('Autorizados sin ejecutar'),
 executed:count('Ejecutados'),rejected:count('Rechazados o revocados'),
 containsA:text.includes('Expediente de prueba pendiente de autorización'),
 containsB:text.includes('CASO EXCLUSIVO SEGUNDA DIÓCESIS QA-V162'),
 alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.innerText),
 form:document.querySelectorAll('form').length};})()`);
 const check=(name,s,ok)=>{report.steps.push({name,ok,measure:s});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(s));if(!ok)throw Error('Failed: '+name)};
 const until=async predicate=>{let s;for(let i=0;i<70;i++){s=await state();if(predicate(s))return s;await sleep(100)}throw Error('Timeout: '+JSON.stringify(s))};
 await call('Page.enable');await call('Runtime.enable');
 await call('Page.navigate',{url:'http://127.0.0.1:4179/?role=chancery&scopeRace=1'});
 let s=await until(x=>x.articles===4&&x.pending===1&&x.authorized===1&&x.executed===1&&x.rejected===1);
 check('A_COUNTS_FULL',s,s.form===1&&!s.containsB);
 await js("window.__v160.slowA=true;[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Actualizar expedientes')).click();true");
 await sleep(60);
 await js("window.__v160.changeIdentity('B');true");
 s=await state();
 check('B_IMMEDIATE_FENCING',s,!s.containsA&&s.pending<=0&&s.authorized<=0&&s.executed<=0&&s.rejected<=0);
 s=await until(x=>x.articles===1&&x.containsB);
 check('B_OWN_COUNTS',s,s.pending===1&&s.authorized===0&&s.executed===0&&s.rejected===0);
 await sleep(1050);
 s=await state();
 check('A_DELAYED_REPLY_NO_LEAK',s,s.articles===1&&!s.containsA&&!s.authorized&&!s.executed);
 await js("window.__v160.changeIdentity('none');true");
 s=await state();
 check('LOGOUT_FENCES_SENSITIVE_COUNTS',s,s.pending<=0&&s.authorized<=0&&s.executed<=0&&s.rejected<=0&&!s.alerts.length);
 await js("window.__v160.changeIdentity('A');true");
 s=await until(x=>x.articles===4&&x.authorized===1);
 check('RETURN_A_RESTORES_CORRECT_COUNTS',s,s.pending===1&&s.authorized===1&&s.executed===1&&s.rejected===1);
}catch(error){report.exceptions.push(String(error?.stack||error));console.error('V170_BROWSER_FAILURE '+String(error?.message||error));}
finally{try{ws?.close()}catch{}try{browser.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
report.passed=report.steps.length===6&&report.steps.every(x=>x.ok)&&report.exceptions.length===0;
fs.writeFileSync('AUDITORIA_NAVEGADOR_CONTEOS_V170.json',JSON.stringify(report,null,2)+'\n');
console.log('V170_BROWSER '+(report.passed?'PASS':'FAIL')+' '+report.steps.length+'/6');
if(!report.passed)process.exitCode=1;
