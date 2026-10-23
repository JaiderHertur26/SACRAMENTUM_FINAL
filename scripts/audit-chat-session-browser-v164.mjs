import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const evidence=path.resolve('AUDITORIA_EVIDENCIA_CHAT_V164');
fs.mkdirSync(evidence,{recursive:true});
const browser='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v164-chat-'));
const proc=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket;
const report={scenario:'Real Chat React component with local mock users and two fictitious dioceses; no Supabase client connected.',steps:[],errors:[],passed:false};
try{
 const active=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(active);i++)await sleep(100);
 if(!fs.existsSync(active))throw Error('Chrome DevTools not ready');
 const [port]=fs.readFileSync(active,'utf8').split(/\r?\n/);
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true});});
 let n=0;const calls=new Map();
 socket.addEventListener('message',e=>{
  let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(msg.id&&calls.has(msg.id)){const t=calls.get(msg.id);calls.delete(msg.id);msg.error?t.reject(Error(msg.error.message)):t.resolve(msg.result||{});}
  if(msg.method==='Runtime.exceptionThrown')report.errors.push(msg.params?.exceptionDetails?.exception?.description||'Runtime exception');
 });
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;calls.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 const state=()=>js("(()=>{const text=document.querySelector('#root')?.innerText||'';return{aRoom:text.includes('SALA PRIVADA DIÓCESIS A'),bRoom:text.includes('SALA PRIVADA DIÓCESIS B'),aMessage:text.includes('MENSAJE CONFIDENCIAL A'),bMessage:text.includes('MENSAJE CONFIDENCIAL B'),draft:document.querySelector('form textarea')?.value||'',subscribed:window.__chatqa?.subscribed||0,unsubscribed:window.__chatqa?.unsubscribed||0,active:window.__chatqa?.subscriptions||0,denied:text.includes('Este canal requiere una sesión institucional activa'),heading:text.includes('Chat Diocesano'),bodyLength:text.length}})()");
 const wait=async(cond,reason)=>{let v;for(let i=0;i<60;i++){v=await state();if(cond(v))return v;await sleep(100)}throw Error(reason+' '+JSON.stringify(v));};
 const assert=(name,condition,value)=>{report.steps.push({name,passed:!!condition,observation:value});console.log((condition?'PASS ':'FAIL ')+name+' '+JSON.stringify(value));if(!condition)throw Error('Assertion '+name+' failed');};
 await cdp('Page.enable');await cdp('Runtime.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1365,screenHeight:900});
 await cdp('Page.navigate',{url:'http://127.0.0.1:4184'});
 let v=await wait(x=>x.aRoom&&x.aMessage,'Initial A page');
 assert('A_ONLY',v.aRoom&&v.aMessage&&!v.bRoom&&!v.bMessage,v);
 await js("(()=>{const el=document.querySelector('form textarea');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(el,'BORRADOR PRIVADO A · V164');el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
 await wait(x=>x.draft.includes('BORRADOR PRIVADO A'),'Private draft');
 await js("window.__chatqa.setSlowA(true);document.querySelector('button[title=Actualizar]').click();true");
 await sleep(70);
 await js("window.__chatqa.changeIdentity('B');true");
 await sleep(100);
 v=await state();
 assert('B_IMMEDIATE_NO_A',!v.aRoom&&!v.aMessage&&!v.draft.includes('BORRADOR PRIVADO A'),v);
 v=await wait(x=>x.bRoom&&x.bMessage&&!x.aRoom&&!x.aMessage,'B page');
 assert('B_ONLY',v.bRoom&&v.bMessage&&!v.aRoom&&!v.aMessage,v);
 const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync(path.join(evidence,'v164-chat-b-excludes-a.png'),Buffer.from(screenshot.data,'base64'));
 await sleep(1250);
 v=await state();
 assert('A_LATE_RESPONSE_EXCLUDED',v.bRoom&&v.bMessage&&!v.aRoom&&!v.aMessage&&v.active<=1,v);
 await js("window.__chatqa.changeIdentity('none');true");
 await sleep(180);
 v=await state();
 assert('LOGOUT_NO_MESSAGES',!v.aRoom&&!v.bRoom&&!v.aMessage&&!v.bMessage&&v.denied,v);
 assert('LOGOUT_UNSUBSCRIBED',v.active===0&&v.subscribed===v.unsubscribed,v);
 await js("window.__chatqa.setSlowA(false);window.__chatqa.changeIdentity('A');true");
 v=await wait(x=>x.aRoom&&x.aMessage,'Restore A');
 assert('A_SIGNIN_NO_CROSS_DATA_OR_DRAFT',v.aRoom&&v.aMessage&&!v.bRoom&&!v.bMessage&&!v.draft,v);
 report.passed=report.steps.length===7&&report.steps.every(x=>x.passed)&&report.errors.length===0;
}catch(e){report.errors.push(String(e.message||e));console.log('V164_CHAT_ERROR '+String(e.message||e));}
finally{try{socket?.close()}catch{}try{proc.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
fs.writeFileSync('AUDITORIA_AISLAMIENTO_CHAT_V164.json',JSON.stringify(report,null,2)+'\n');
console.log('V164_CHAT_SUMMARY '+report.steps.filter(x=>x.passed).length+'/'+report.steps.length+' passed='+report.passed);
if(!report.passed)process.exitCode=2;
