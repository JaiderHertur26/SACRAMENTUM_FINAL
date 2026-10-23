// V160: browser interactions on real React page, with isolated synthetic role/data mocks.
// Absolutely no Supabase network client or real user credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const browser='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v160-clicks-'));
const child=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const sleep=t=>new Promise(r=>setTimeout(r,t));
let ws;const outcomes=[],exceptions=[];
try{
 const active=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<80&&!fs.existsSync(active);i++)await sleep(100);
 if(!fs.existsSync(active))throw Error('Chrome unable to open');
 const [port]=fs.readFileSync(active,'utf8').trim().split(/\r?\n/);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
 let seq=0;const pending=new Map();
 ws.addEventListener('message',e=>{
  let x;try{x=JSON.parse(e.data)}catch{return}
  if(x.id&&pending.has(x.id)){const cb=pending.get(x.id);pending.delete(x.id);x.error?cb.reject(Error(x.error.message)):cb.resolve(x.result||{});}
  if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params?.exceptionDetails?.exception?.description||'Uncaught');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async exp=>{const r=await call('Runtime.evaluate',{expression:exp,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 await call('Page.enable');await call('Runtime.enable');
 async function navigate(role){
  await call('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1365,screenHeight:900});
  await call('Page.navigate',{url:'http://127.0.0.1:4179/?role='+role+'&scenario='+Date.now()});
  for(let i=0;i<45;i++){await sleep(140);const state=await js("({role:window.__v160?.role,articles:document.querySelectorAll('article').length})");
   if(state?.articles===4&&state.role===role)return;}
  throw Error('Page did not render '+role);
 }
 const scenarios=[
  {id:'diocese-authorize',role:'diocese',index:0,button:'Autorizar expediente',ref:'APROBACIÓN QA V160 101',reason:'Autorización ficticia documental suficientemente motivada y controlada.',expected:'approve'},
  {id:'diocese-reject',role:'diocese',index:0,button:'Registrar rechazo',ref:'RECHAZO QA V160 102',reason:'El expediente no cumple los requisitos documentales de este ensayo.',expected:'reject'},
  {id:'diocese-revoke',role:'diocese',index:1,button:'Revocar autorización',ref:'REVOCACIÓN QA V160 103',reason:'La autorización ficticia requiere dejarse sin efectos por nueva evidencia.',expected:'reject'},
  {id:'chancery-execute',role:'chancery',index:1,button:'Ejecutar resolución autorizada',expected:'execute'}
 ];
 for(const x of scenarios){
  await navigate(x.role);
  const payload=JSON.stringify(x);
  const click=await js(`(()=>{const s=${payload};const article=document.querySelectorAll('article')[s.index];
   if(!article)return {error:'article-missing'};
   const button=[...article.querySelectorAll('button')].find(x=>x.innerText.trim()===s.button);
   if(!button)return {error:'button-missing',available:[...article.querySelectorAll('button')].map(x=>x.innerText.trim())};
   if(s.ref){const wrapper=button.parentElement;
    const inp=wrapper.querySelector('input'); const area=wrapper.querySelector('textarea');
    if(!inp||!area)return {error:'inputs-missing'};
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(inp,s.ref);inp.dispatchEvent(new Event('input',{bubbles:true}));
    const writer=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
    writer.call(area,s.reason);area.dispatchEvent(new Event('input',{bubbles:true}));
   }
   return {button:button.innerText.trim(),clicked:true};
  })()`);
  if(!click.clicked){outcomes.push({id:x.id,passed:false,click});console.log('FAIL '+x.id+': '+JSON.stringify(click));continue;}
  await sleep(150);
  await js(`(()=>{const s=${payload};const article=document.querySelectorAll('article')[s.index];
   const button=[...article.querySelectorAll('button')].find(x=>x.innerText.trim()===s.button);
   if(button)button.click();return true;})()`);
  await sleep(450);
  const result=await js("({history:window.__v160?.history||[],records:window.__v160?.records?.map(r=>({id:r.id,status:r.status}))||[],errors:[...document.querySelectorAll('[role=alert]')].map(x=>x.innerText)})");
  const hits=result.history.filter(y=>y.action===x.expected);
  const passed=hits.length===1&&!result.errors.some(y=>/requiere|referencia/i.test(y));
  outcomes.push({id:x.id,role:x.role,expected:x.expected,passed,history:result.history,errors:result.errors});
  console.log((passed?'PASS ':'FAIL ')+x.id+' action='+hits.length+' errors='+result.errors.length);
 }
}finally{try{ws?.close()}catch{}try{child.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
fs.writeFileSync('AUDITORIA_INTERACCIONES_CONCILIACION_V160.json',JSON.stringify({
 scope:'Actual reconciliation React component in isolated Chrome, role mocks & fake records, never a production authenticated session',
 tests:outcomes,passed:outcomes.filter(x=>x.passed).length,failed:outcomes.filter(x=>!x.passed).length,runtimeExceptions:exceptions
},null,2)+'\n');
console.log('V160_CLICK_SUMMARY '+outcomes.filter(x=>x.passed).length+'/'+outcomes.length);
if(outcomes.some(x=>!x.passed)||exceptions.length)process.exitCode=2;
