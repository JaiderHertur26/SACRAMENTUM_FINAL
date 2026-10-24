// V186 · Browser real de pantalla de acceso, sin iniciar sesión ni escribir datos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const browser=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
if(!browser)throw Error('Chrome / Edge no disponible');
const p=path.join(os.tmpdir(),'sacramentum-v186-browser-'+process.pid);
const folder='AUDITORIA_EVIDENCIA_IDENTIDAD_V186';
fs.mkdirSync(p,{recursive:true});fs.mkdirSync(folder,{recursive:true});
const child=spawn(browser,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+p,'about:blank'],{stdio:'ignore'});
const sleep=x=>new Promise(r=>setTimeout(r,x));
let socket;const rows=[];const errors=[];
try {
 const portFile=path.join(p,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);
 if(!fs.existsSync(portFile))throw Error('DevTools no inicio');
 const [port]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true});});
 let serial=0;const pending=new Map();
 socket.addEventListener('message',e=>{
  let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.method==='Runtime.exceptionThrown')errors.push('Chrome JS exception');
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result||{});}
 });
 const cdp=(method,params={})=>new Promise((res,rej)=>{const id=++serial;pending.set(id,{resolve:res,reject:rej});socket.send(JSON.stringify({id,method,params}));});
 await cdp('Page.enable');await cdp('Runtime.enable');
 const expression=[
  '(async()=>{await document.fonts.ready;',
  'const img=document.querySelector("main img[alt*=Barranquilla]");',
  'const heading=document.querySelector("main h1");',
  'const form=document.querySelector("aside form");',
  'return JSON.stringify({title:document.title,innerWidth,scrollWidth:document.documentElement.scrollWidth,',
  'formVisible:!!form,heading:heading?.innerText||null,',
  'oldHeading:document.body.innerText.includes("Plataforma Eclesial Unificada"),',
  'crestLoaded:!!img?.naturalWidth,crestSrc:img?.getAttribute("src"),',
  'asideBackground:getComputedStyle(document.querySelector("aside")).backgroundImage,',
  'mainVisible:!!document.querySelector("main")})})()'
 ].join('');
 for(const [name,width,height,mobile] of [['desktop',1440,900,false],['tablet',768,1024,true],['mobile',390,844,true]]) {
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height});
  await cdp('Page.navigate',{url:'http://127.0.0.1:4828/login'});
  await sleep(3400);
  const ev=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if (!ev.result?.value) throw new Error('CDP evaluate error: '+JSON.stringify(ev).slice(0,1000));
  const data=typeof ev.result.value==='string'?JSON.parse(ev.result.value):ev.result.value;
  const capture=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  const file='v186-'+name+'.png';const bytes=Buffer.from(capture.data,'base64');fs.writeFileSync(path.join(folder,file),bytes);
  const passed=data.formVisible&&data.crestLoaded&&/Arquidiócesis\s+de Barranquilla/.test(data.heading)&&!data.oldHeading&&data.scrollWidth<=width+1;
  rows.push({size:name,width,height,...data,pass:passed,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),screenshot:file});
  console.log((passed?'PASS ':'FAIL ')+name+' viewport='+width+' x '+height+', logo='+data.crestLoaded+', overflow='+(data.scrollWidth-width));
 }
}finally{
 try{socket?.close()}catch{}try{child.kill()}catch{}
 await sleep(200);try{fs.rmSync(p,{recursive:true,force:true})}catch{}
}
const report={protocol:'V186 visual actual sin inicio de sesión',rows,jsExceptions:errors.length,approved:rows.every(x=>x.pass)&&errors.length===0};
fs.writeFileSync('AUDITORIA_IDENTIDAD_BROWSER_V186.json',JSON.stringify(report,null,2)+'\n');
console.log('V186 BROWSER '+(report.approved?'PASS':'FAIL')+' '+rows.filter(x=>x.pass).length+'/'+rows.length+', JS exceptions='+errors.length);
if(!report.approved)process.exitCode=1;
