import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const url='http://127.0.0.1:4814/';
const evidence=path.join(process.cwd(),'AUDITORIA_EVIDENCIA_VISUAL_V131');
fs.mkdirSync(evidence,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v131-'));
const child=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
 '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+temp,
 'about:blank'],{stdio:'ignore'});
const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
let ws;const results=[];
try{
 const flag=path.join(temp,'DevToolsActivePort');
 for(let i=0;i<80&&!fs.existsSync(flag);i++)await sleep(100);
 if(!fs.existsSync(flag))throw Error('Chrome CDP unavailable');
 const port=fs.readFileSync(flag,'utf8').trim().split(/\r?\n/)[0];
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 let id=0;const pending=new Map(),exceptions=[],requests=[];
 ws.addEventListener('message',e=>{
  let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);
   m.error?p.reject(Error(m.error.message)):p.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params?.exceptionDetails?.text||'Uncaught');
  if(m.method==='Network.requestWillBeSent')requests.push(m.params?.request?.url||'');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));
 });
 const evaluate=async expression=>{
  const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result?.value;
 };
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 const tests=[
  {role:'chancery',size:'desktop',w:1440,h:1000},
  {role:'chancery',size:'mobile',w:390,h:844},
  {role:'diocese',size:'desktop',w:1440,h:1000},
  {role:'diocese',size:'mobile',w:390,h:844},
  {role:'parish',size:'desktop',w:1440,h:900,forbidden:true},
  {role:'admin_general',size:'desktop',w:1440,h:900,forbidden:true}
 ];
 for(const t of tests){
  await call('Emulation.setDeviceMetricsOverride',{
   width:t.w,height:t.h,deviceScaleFactor:1,mobile:t.w<600,screenWidth:t.w,screenHeight:t.h});
  const errorsBefore=exceptions.length,networkBefore=requests.length;
  await call('Page.navigate',{url:url+'?role='+t.role});
  let state={};
  for(let i=0;i<55;i++){
   await sleep(250);
   state=await evaluate('({text:document.querySelector("#root")?.innerText||"",width:innerWidth,scroll:document.documentElement.scrollWidth})');
   if(state.text.includes('Vista de ')&&(t.forbidden||state.text.includes('Autorización institucional previa')))break;
  }
  const rendered=state.text?.includes('Autorización institucional previa')||false;
  const correct=t.forbidden?!rendered:rendered&&state.text.includes(t.role==='diocese'?'Autorizar':'Solicitar revisión');
  const noOverflow=state.scroll<=t.w+2;
  const external=requests.slice(networkBefore).filter(v=>/supabase\.co|rest\/v1/i.test(v));
  const noErrors=exceptions.length===errorsBefore;
  const screen=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const bytes=Buffer.from(screen.data,'base64'),file=t.role+'-'+t.size+'.png';
  fs.writeFileSync(path.join(evidence,file),bytes);
  const pass=correct&&noOverflow&&noErrors&&external.length===0;
  results.push({test:t.role+'-'+t.size,pass,rendered,noOverflow,noErrors,
   browserWidth:t.w,scrollWidth:state.scroll,externalRequests:external.length,file,
   sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  console.log((pass?'PASS ':'FAIL ')+t.role+' '+t.size+' rendered='+rendered+' overflow='+(!noOverflow));
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:url+'?role=diocese'});
 await sleep(1700);
 const disabledBefore=await evaluate('[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Autorizar")?.disabled===true');
 await evaluate('(()=>{const el=document.querySelector("input[data-qa-doc-review]");const dt=new DataTransfer();dt.items.add(new File(["wrong"],"falso.pdf",{type:"application/pdf"}));el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
 await sleep(500);
 const rejectedWrong=await evaluate('document.body.innerText.includes("DOCUMENTO DIFERENTE")&&[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Autorizar")?.disabled===true');
 await evaluate('(()=>{const el=document.querySelector("input[data-qa-doc-review]");const dt=new DataTransfer();dt.items.add(new File(["abc"],"copia-coincidente.pdf",{type:"application/pdf"}));el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
 await sleep(500);
 const matches=await evaluate('document.body.innerText.includes("Huella SHA-256 idéntica")&&[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Autorizar")?.disabled===false');
 await evaluate('([...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Autorizar")?.click(),true)');
 await sleep(700);
 const review=await evaluate('({reviewed:document.body.innerText.includes("Revisado por Diócesis"),calls:window.__qaCalls.filter(x=>x.name==="review_marriage_nullity_execution_v128").length,disabledBefore:'+(disabledBefore?'true':'false')+',rejectedWrong:'+(rejectedWrong?'true':'false')+',matches:'+(matches?'true':'false')+'})');
 const reviewPass=disabledBefore&&rejectedWrong&&matches&&review.reviewed&&review.calls===1;
 results.push({test:'diocesan-review-click',pass:reviewPass,detail:review});
 console.log((reviewPass?'PASS ':'FAIL ')+'diocese click '+JSON.stringify(review));
 await call('Page.navigate',{url:url+'?role=chancery'});
 await sleep(1700);
 const before=await evaluate('({count:window.__qaCalls.filter(x=>x.name==="apply_marriage_nullity").length,button:[...document.querySelectorAll("button")].some(x=>x.textContent.includes("Ejecutar y asentar decreto"))})');
 await evaluate('([...document.querySelectorAll("button")].find(x=>x.textContent.includes("Ejecutar y asentar decreto"))?.click(),true)');
 await sleep(750);
 const after=await evaluate('({executed:document.body.innerText.includes("Decreto archivado"),count:window.__qaCalls.filter(x=>x.name==="apply_marriage_nullity").length})');
 const executePass=before.count===0&&before.button&&after.count===1&&after.executed;
 results.push({test:'chancery-execute-authorized-click',pass:executePass,detail:after});
 console.log((executePass?'PASS ':'FAIL ')+'chancery execution '+JSON.stringify(after));
}finally{try{ws?.close()}catch{}try{child.kill()}catch{}}
const report={protocol:'V131',mode:'React real + navegador Chrome CDP; Supabase y roles ficticios sin ninguna credencial',timestamp:new Date().toISOString(),
 passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,total:results.length,tests:results,
 notCovered:'Navegación autenticada con usuarios de producción, permisos REST reales, custodia de documentos e impresión'};
fs.writeFileSync('AUDITORIA_REACT_BROWSER_NULIDAD_V131.json',JSON.stringify(report,null,2)+'\n');
console.log('V131 BROWSER '+report.passed+'/'+report.total);
if(report.failed)process.exitCode=2;