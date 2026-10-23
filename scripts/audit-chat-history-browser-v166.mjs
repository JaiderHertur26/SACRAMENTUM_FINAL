import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const pause=t=>new Promise(r=>setTimeout(r,t));
const browser='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v166-browser-'));
const proc=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const report={scope:'Real React chat + isolated fictitious 312-message Chrome test, two mock users; no Supabase network.',steps:[],errors:[],passed:false};
let socket;
try{
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portFile);i++)await pause(100);
 if(!fs.existsSync(portFile))throw Error('CDP unavailable');
 const [port]=fs.readFileSync(portFile,'utf8').split(/\r?\n/);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true});});
 let seq=0;const calls=new Map();
 socket.addEventListener('message',event=>{
  let m;try{m=JSON.parse(event.data)}catch{return}
  if(m.id&&calls.has(m.id)){const a=calls.get(m.id);calls.delete(m.id);m.error?a.reject(Error(m.error.message)):a.resolve(m.result||{});}
  if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params?.exceptionDetails?.exception?.description||'Uncaught');
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;calls.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 const run=async expression=>{
  const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);
  return out.result?.value;
 };
 const snapshot=()=>run("(()=>{const t=document.querySelector('#root')?.innerText||'';const legacy=t.match(/QA-V166-LEGACY-\\d{4}/g)||[];const recent=t.match(/QA-V166-RECENT-\\d+/g)||[];return {count:legacy.length+recent.length,legacy:legacy.length,recent:recent.length,unique:new Set([...legacy,...recent]).size,hasOlder:t.includes('Cargar 80 mensajes anteriores'),aRoom:t.includes('SALA PRIVADA DIÓCESIS A'),bRoom:t.includes('SALA PRIVADA DIÓCESIS B'),bMessage:t.includes('MENSAJE CONFIDENCIAL B'),overflow:document.documentElement.scrollWidth>innerWidth,subscriptions:window.__chatqa?.subscriptions||0}})()");
 const wait=async(predicate,label)=>{let state;for(let i=0;i<60;i++){state=await snapshot();if(predicate(state))return state;await pause(150);}throw Error(label+' '+JSON.stringify(state));};
 const add=(name,passed,state)=>{report.steps.push({name,passed,observed:state});console.log((passed?'PASS ':'FAIL ')+name+' '+JSON.stringify(state));if(!passed)throw Error(name);};
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1365,screenHeight:900});
 await send('Page.navigate',{url:'http://127.0.0.1:4184/?v166History=1'});
 let v=await wait(x=>x.count===80&&x.aRoom,'V166 initial 80');
 add('INITIAL_80',v.count===80&&v.hasOlder&&!v.overflow,v);
 for(const n of [160,240,312]){
  const clicked=await run("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Cargar 80 mensajes anteriores'));if(!b)return false;b.click();return true;})()");
  if(!clicked)throw Error('History button missing before '+n);
  v=await wait(x=>x.count===n,'V166 history page '+n);
  add('PAGE_'+n,v.count===n&&v.unique===n&&!v.overflow,v);
 }
 add('FULL_HISTORY',v.legacy===305&&v.recent===7&&!v.hasOlder&&v.unique===312,v);
 fs.mkdirSync('AUDITORIA_EVIDENCIA_CHAT_V166',{recursive:true});
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync('AUDITORIA_EVIDENCIA_CHAT_V166/v166-chat-history-312.png',Buffer.from(shot.data,'base64'));
 await run("window.__chatqa.changeIdentity('B');true");
 v=await wait(x=>x.bMessage&&!x.aRoom&&x.count===0,'Switch to B no A history');
 add('CROSS_IDENTITY_HISTORY_REMOVED',v.bRoom&&v.bMessage&&v.count===0&&v.subscriptions<=1,v);
 report.passed=report.steps.length===6&&report.steps.every(s=>s.passed)&&report.errors.length===0;
}catch(e){report.errors.push(String(e.message||e));console.log('V166_BROWSER_FAILURE '+String(e.message||e));}
finally{try{socket?.close()}catch{}try{proc.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
fs.writeFileSync('AUDITORIA_CHAT_PAGINACION_VISUAL_V166.json',JSON.stringify(report,null,2)+'\n');
console.log('V166_BROWSER_SUMMARY '+report.steps.filter(x=>x.passed).length+'/'+report.steps.length+' overall='+report.passed);
if(!report.passed)process.exitCode=2;
