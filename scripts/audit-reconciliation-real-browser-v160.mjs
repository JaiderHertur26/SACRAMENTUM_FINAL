// V160: Real Chrome/CDP runs the REAL reconciliation React component,
// with explicit isolated role/data mocks. Not an authenticated Supabase E2E.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const browser='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidence=path.resolve('AUDITORIA_EVIDENCIA_VISUAL_V160');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v160-isolated-'));
const cases=[['chancery','mobile',390,844],['chancery','tablet',768,1024],['chancery','desktop',1365,900],['diocese','mobile',390,844],['diocese','tablet',768,1024],['diocese','desktop',1365,900]];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(evidence,{recursive:true});
if(!fs.existsSync(browser))throw Error('Chrome unavailable');
const child=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws; const output=[]; const failures=[];
try {
 const portfile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<90&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Chrome CDP unavailable');
 const [port]=fs.readFileSync(portfile,'utf8').trim().split(/\r?\n/);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=targets.find(x=>x.type==='page'); if(!target)throw Error('Page target not found');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const pending=new Map();let seq=0;
 ws.addEventListener('message',e=>{
  let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(msg.id&&pending.has(msg.id)){const r=pending.get(msg.id);pending.delete(msg.id);msg.error?r.reject(Error(msg.error.message)):r.resolve(msg.result||{});}
  if(msg.method==='Runtime.exceptionThrown')failures.push(msg.params?.exceptionDetails?.exception?.description||msg.params?.exceptionDetails?.text||'Runtime exception');
 });
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 await cdp('Page.enable');await cdp('Runtime.enable');
 async function evaluate(expression){const out=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(out.exceptionDetails)throw Error(out.exceptionDetails.text||'JS execution error');return out.result?.value;}
 for(const [role,size,width,height] of (process.env.V160_SINGLE ? cases.slice(0,1) : cases)){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600,screenWidth:width,screenHeight:height});
  const before=failures.length;
  await cdp('Page.navigate',{url:'http://127.0.0.1:4179/?role='+role});
  let metrics;
  for(let i=0;i<45;i++){
   await sleep(220);
   metrics=await evaluate(`(()=>({title:document.title,role:window.__v160?.role||null,body:document.querySelector('#root')?.innerText||'',w:innerWidth,scrollWidth:document.documentElement.scrollWidth,h:innerHeight,h1:document.querySelector('h1')?.innerText||'',formCount:document.querySelectorAll('form').length,buttons:[...document.querySelectorAll('button')].map(x=>x.innerText.trim()),navCount:document.querySelectorAll('a').length,articles:document.querySelectorAll('article').length}))()`);
   if(metrics?.h1.includes('Conciliación de notas posteriores')&&metrics.articles>=4)break;
  }
  const required=role==='chancery'?
   metrics.formCount===1&&metrics.buttons.some(x=>x.includes('Enviar solicitud'))&&metrics.buttons.some(x=>x.includes('Ejecutar resolución'))&&!metrics.buttons.some(x=>x.includes('Registrar rechazo')):
   metrics.formCount===0&&metrics.buttons.some(x=>x.includes('Autorizar expediente'))&&metrics.buttons.some(x=>x.includes('Registrar rechazo'))&&metrics.buttons.some(x=>x.includes('Revocar autorización'))&&!metrics.buttons.some(x=>x.includes('Ejecutar resolución'));
  const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const bytes=Buffer.from(screenshot.data,'base64');
  const filename='v160-'+role+'-'+size+'.png';
  fs.writeFileSync(path.join(evidence,filename),bytes);
  const passed=metrics.role===role&&metrics.w===width&&metrics.h1.includes('Conciliación de notas posteriores')&&metrics.articles===4&&metrics.scrollWidth<=width+2&&required&&failures.length===before;
  output.push({role,size,width,height,passed,metrics:{heading:metrics.h1,role:metrics.role,rendered:metrics.body.length,scrollWidth:metrics.scrollWidth,formCount:metrics.formCount,articles:metrics.articles,buttons:metrics.buttons},runtimeExceptions:failures.slice(before),filename,screenshotBytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  console.log((passed?'PASS ':'FAIL ')+role+'/'+size+' overflow='+Math.max(0,metrics.scrollWidth-width)+' forms='+metrics.formCount+' articles='+metrics.articles+' screenshot='+bytes.length);
 }
}finally{try{ws?.close()}catch{}try{child.kill()}catch{}try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}
fs.writeFileSync('AUDITORIA_VISUAL_CONCILIACIONES_V160.json',JSON.stringify({
 scope:'Real Chrome on isolated local Vite with authentic reconciliation React component, fictitious mock actors/data; NOT production logged-in UI',
 generatedAt:new Date().toISOString(),tests:output,passed:output.filter(x=>x.passed).length,failed:output.filter(x=>!x.passed).length,consoleExceptions:failures
},null,2)+'\n');
console.log('V160_VISUAL_SUMMARY '+output.filter(x=>x.passed).length+'/'+cases.length);
if(output.some(x=>!x.passed))process.exitCode=2;
