// SACRAMENTUM V91 - auditoría visual pública sin login ni datos escritos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
const urls=[['tailwind3','http://127.0.0.1:4811/'],['tailwind4','http://127.0.0.1:4812/']];
const sizes=[['mobile',390,844,true],['tablet',768,1024,true],['desktop',1365,900,false]];
const browser=process.env.CHROME_PATH||[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].find(fs.existsSync);
if(!browser)throw new Error('Chrome no localizado.');
const temp=path.join(os.tmpdir(),'sacramentum-v91-cdp-'+process.pid);
const evidence=path.resolve(process.argv[2]||'C:\\SACRAMENTUM\\AUDITORIA_EVIDENCIAS_V91');
fs.mkdirSync(evidence,{recursive:true});
fs.mkdirSync(temp,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
 '--disable-background-networking','--no-default-browser-check','--remote-debugging-port=0',
 '--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
const results=[];
let ws;
try{
 const portFile=path.join(temp,'DevToolsActivePort');
 for(let i=0;i<70&&!fs.existsSync(portFile);i++)await sleep(100);
 if(!fs.existsSync(portFile))throw new Error('Chrome no abrió DevToolsActivePort.');
 const [port]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const target=targets.find(x=>x.type==='page');
 if(!target)throw new Error('No se encontró página CDP.');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
 let id=0;
 const pending=new Map();
 ws.addEventListener('message',e=>{
  let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);
   m.error?p.reject(new Error(m.error.message)):p.resolve(m.result||{});
  }
 });
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{
  const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));
 });
 await cdp('Page.enable');await cdp('Runtime.enable');
 const expression=[
 '(async()=>{await document.fonts.ready;',
 'const box=(s)=>{const n=document.querySelector(s);if(!n)return null;',
 'const b=n.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),',
 'width:Math.round(b.width),height:Math.round(b.height)}};',
 'return JSON.stringify({title:document.title,innerWidth:window.innerWidth,',
 'scrollWidth:document.documentElement.scrollWidth,',
 'rootTextLength:document.querySelector("#root")?.innerText?.length||0,',
 'heading:box("h1"),form:box("form"),input:box("input"),aside:box("aside"),',
 'button:box("button[type=submit]"),main:box("main"),',
 'horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth});})()'
 ].join('');
 for(const [size,width,height,mobile] of sizes){
  await cdp('Emulation.setDeviceMetricsOverride',{
   width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height
  });
  for(const [variant,url] of urls){
   await cdp('Page.navigate',{url});await sleep(2500);
   const ev=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
   const metrics=JSON.parse(ev.result?.value||'{}');
   const shot=await cdp('Page.captureScreenshot',{
     format:'png',captureBeyondViewport:false,fromSurface:true
   });
   const filename='sacramentum-v91-'+variant+'-'+size+'.png';
   const bytes=Buffer.from(shot.data,'base64');
   fs.writeFileSync(path.join(evidence,filename),bytes);
   const check={variant,size,width,height,mobile,url,metrics,filename,screenshotBytes:bytes.length,
    sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    passed:metrics.innerWidth===width&&metrics.rootTextLength>100&&!metrics.horizontalOverflow};
   console.log((check.passed?'OK':'REVISAR')+' '+variant+' '+size+
     ' innerWidth='+metrics.innerWidth+' scrollWidth='+metrics.scrollWidth+' bytes='+bytes.length);
   results.push(check);
  }
 }
}finally{try{ws?.close()}catch{}try{child.kill()}catch{}}
const report={testedAt:new Date().toISOString(),scope:'Pantalla pública sin autenticación.',
 method:'Chrome CDP, emulación real de viewport y captura SHA256',
 results,pass:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length};
fs.writeFileSync('AUDITORIA_VISUAL_PUBLICA_V91.json',JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+report.pass+'/'+results.length);
if(report.failed)process.exitCode=2;
