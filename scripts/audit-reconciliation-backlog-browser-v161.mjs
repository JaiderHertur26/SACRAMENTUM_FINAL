// V161 physical browser: old pending dossier remains visible despite >315 newer rejected cases.
// Actual React component, Chrome CDP, fake users/data and NO database connection.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const sleep=t=>new Promise(resolve=>setTimeout(resolve,t));
const browser='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v161-backlog-'));
const evidence=path.resolve('AUDITORIA_EVIDENCIA_VISUAL_V161');
fs.mkdirSync(evidence,{recursive:true});
const proc=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
 '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws;const errors=[];
let result={};
try{
 const portfile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<80&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('CDP port absent');
 const [port]=fs.readFileSync(portfile,'utf8').split(/\r?\n/);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
 let id=0;const jobs=new Map();
 ws.addEventListener('message',event=>{
  let x;try{x=JSON.parse(event.data)}catch{return}
  if(x.id&&jobs.has(x.id)){const r=jobs.get(x.id);jobs.delete(x.id);x.error?r.reject(Error(x.error.message)):r.resolve(x.result||{});}
  if(x.method==='Runtime.exceptionThrown')errors.push(x.params?.exceptionDetails?.exception?.description||'Uncaught');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;jobs.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value;};
 const snapshot=()=>js("({articles:document.querySelectorAll('article').length,oldVisible:document.querySelector('#root')?.innerText.includes('EXPEDIENTE ANTIGUO PENDIENTE V161')||false,counters:[...document.querySelectorAll('button[aria-pressed]')].map(x=>x.innerText.trim()),pageLabels:[...document.querySelectorAll('article')].map(x=>x.innerText.slice(0,140)),loadMore:[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Cargar 50 expedientes anteriores')),overflow:document.documentElement.scrollWidth>innerWidth})");
 const click=prefix=>js("(()=>{const button=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith("+JSON.stringify(prefix)+"));if(!button)return false;button.click();return true;})()");
 const wait=async fn=>{for(let i=0;i<45;i++){const val=await fn();if(val)return val;await sleep(120);}throw Error('Browser condition timed out');};
 await call('Page.enable');await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1365,screenHeight:900});
 await call('Page.navigate',{url:'http://127.0.0.1:4179/?role=diocese&backlog=1'});
 await wait(async()=>{const x=await snapshot();return x.articles===50&&x.counters.some(c=>c.startsWith('Pendientes (2)'));});
 const initial=await snapshot();
 if(!await click('Pendientes ('))throw Error('Pending filter missing');
 await wait(async()=>{const x=await snapshot();return x.articles===2&&x.oldVisible;});
 const pending=await snapshot();
 const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync(path.join(evidence,'v161-pending-ancient-visible.png'),Buffer.from(shot.data,'base64'));
 if(!await click('Rechazados ('))throw Error('Rejected filter missing');
 await wait(async()=>{const x=await snapshot();return x.articles===50&&x.loadMore;});
 const pageOne=await snapshot();
 if(!await click('Cargar 50 expedientes anteriores'))throw Error('Load more button missing');
 await wait(async()=>{const x=await snapshot();return x.articles===100;});
 const pageTwo=await snapshot();
 result={initial:{articles:initial.articles,counters:initial.counters,oldVisible:initial.oldVisible},
 pending:{articles:pending.articles,oldVisible:pending.oldVisible},
 rejectedFirst:{articles:pageOne.articles,loadMore:pageOne.loadMore},
 rejectedSecond:{articles:pageTwo.articles,unique:new Set(pageTwo.pageLabels).size},
 allNoOverflow:![initial,pending,pageOne,pageTwo].some(x=>x.overflow),
 errors};
 result.passed=result.initial.articles===50&&result.pending.articles===2&&result.pending.oldVisible&&
 result.rejectedFirst.articles===50&&result.rejectedSecond.articles===100&&
 result.rejectedSecond.unique===100&&result.allNoOverflow&&errors.length===0;
 console.log('V161_BROWSER_OLD_PENDING_AND_KEYSET '+(result.passed?'PASS':'FAIL')+' '+JSON.stringify(result));
}finally{try{ws?.close()}catch{}try{proc.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
fs.writeFileSync('AUDITORIA_PAGINACION_VISUAL_V161.json',JSON.stringify({
 scope:'Actual React component, isolated real Chrome, 315+ fictional rejected and old pending, no real Supabase authentication or data.',
 ...result
},null,2)+'\n');
if(!result.passed)process.exitCode=2;
