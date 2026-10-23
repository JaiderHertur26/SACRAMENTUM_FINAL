// V162 · Actual React page isolation across simulated authenticated users.
// Chrome CDP + isolated mock Supabase; NEVER reads real sessions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const sleep=t=>new Promise(r=>setTimeout(r,t));
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v162-cross-scope-'));
const evidence=path.resolve('AUDITORIA_EVIDENCIA_VISUAL_V162');
fs.mkdirSync(evidence,{recursive:true});
const proc=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking',
 '--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,report={passed:false,steps:[],errors:[]};
try{
 const portfile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<90&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Chrome debugging unavailable');
 const [port]=fs.readFileSync(portfile,'utf8').trim().split(/\r?\n/);
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
 let seq=0;const pending=new Map();
 ws.addEventListener('message',e=>{
  let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result||{});}
  if(msg.method==='Runtime.exceptionThrown')report.errors.push(msg.params?.exceptionDetails?.exception?.description||'Uncaught exception');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const js=async exp=>{const x=await call('Runtime.evaluate',{expression:exp,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);return x.result?.value;};
 const state=()=>js("(()=>{const root=document.querySelector('#root');const body=root?.innerText||'';return {actor:window.__v160?.role||'?',articles:document.querySelectorAll('article').length,containsA:body.includes('Expediente de prueba pendiente de autorización'),containsB:body.includes('CASO EXCLUSIVO SEGUNDA DIÓCESIS QA-V162'),form:document.querySelectorAll('form').length,counters:[...document.querySelectorAll('button[aria-pressed]')].map(x=>x.innerText.trim()),hasOldDecree:body.includes('00000000-0000-0000-0000-000000000201')}})()");
 const wait=async(fn,msg)=>{let last;for(let i=0;i<60;i++){last=await state();if(fn(last))return last;await sleep(100)}throw Error(msg+' '+JSON.stringify(last))};
 const record=(name,detail,passed)=>{report.steps.push({name,passed,detail});console.log((passed?'PASS ':'FAIL ')+name+' '+JSON.stringify(detail));if(!passed)throw Error(name+' failed');};
 await call('Page.enable');await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1365,screenHeight:900});
 await call('Page.navigate',{url:'http://127.0.0.1:4179/?role=chancery&scopeRace=1'});
 let current=await wait(x=>x.articles===4&&x.containsA&&!x.containsB,'Initial A scope not rendered');
 record('A_INITIAL_VIEW',{articles:current.articles,form:current.form,containsB:current.containsB},current.form===1&&!current.containsB);
 await js("window.__v160.slowA=true;[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Actualizar expedientes')).click();true");
 await sleep(60);
 await js("window.__v160.changeIdentity('B');true");
 await sleep(80);
 current=await state();
 record('B_SWITCH_IMMEDIATE_MASK',{articles:current.articles,containsA:current.containsA,form:current.form},!current.containsA&&current.form===0&&((current.articles===0)||(current.articles===1&&current.containsB)));
 current=await wait(x=>x.articles===1&&x.containsB&&!x.containsA,'B profile did not load');
 record('B_AUTHORIZED_SCOPE',{articles:current.articles,containsB:current.containsB,counters:current.counters},current.counters.some(x=>x==='Todos (1)'));
 const png=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync(path.join(evidence,'v162-diocese-b-no-cross-scope.png'),Buffer.from(png.data,'base64'));
 await sleep(1100);
 current=await state();
 record('A_LATE_RESPONSE_DISCARDED',{articles:current.articles,containsA:current.containsA,containsB:current.containsB},current.articles===1&&!current.containsA&&current.containsB);
 await js("window.__v160.changeIdentity('none');true");
 await sleep(120);
 current=await state();
 record('LOGOUT_FAILS_CLOSED',{articles:current.articles,form:current.form,containsA:current.containsA,containsB:current.containsB},current.articles===0&&current.form===0&&!current.containsA&&!current.containsB);
 await js("window.__v160.changeIdentity('A');true");
 current=await wait(x=>x.articles===4&&x.containsA&&!x.containsB,'A return did not recover own records');
 record('A_SIGNIN_RECOVERS_OWN_SCOPE',{articles:current.articles,form:current.form,containsB:current.containsB},current.form===1);
 report.passed=report.steps.length===6&&report.steps.every(x=>x.passed)&&report.errors.length===0;
}catch(e){report.errors.push(String(e.message||e));console.log('V162_FAILURE '+String(e.message||e));}
finally{try{ws?.close()}catch{}try{proc.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
fs.writeFileSync('AUDITORIA_AISLAMIENTO_SESION_V162.json',JSON.stringify({
 scope:'Real React component and Chrome, simulated users and delayed mock requests ONLY, not two real authenticated accounts.',
 ...report
},null,2)+'\n');
console.log('V162_SESSION_ISOLATION '+(report.passed?'PASS':'FAIL')+' '+report.steps.length+'/6');
if(!report.passed)process.exitCode=2;
