// V195: Chrome real, plantillas reales de impresión, expedientes 100% ficticios.
// No login de Supabase; no afirma prueba autenticada ni impresión física.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const chrome=[
'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!chrome)throw Error('Chrome / Edge no instalado');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v195-'));
const evidence=path.resolve('..','AUDITORIA_EVIDENCIAS_IMPRESION_V195');
fs.mkdirSync(evidence,{recursive:true});
const browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
 '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const attack=process.env.V195_XSS==='1'||process.argv.includes('--xss');
const exceptions=[];const results=[];let socket;
try{
 const portfile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Chrome CDP unavailable');
 const [port]=fs.readFileSync(portfile,'utf8').trim().split(/\r?\n/);
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 const waiting=new Map();let seq=0;
 socket.addEventListener('message',event=>{
  let msg;try{msg=JSON.parse(event.data);}catch{return;}
  if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result||{});}
  if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.exception?.description||'JS runtime exception');
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{
  const ret=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(ret.exceptionDetails)throw Error(ret.exceptionDetails.exception?.description||ret.exceptionDetails.text);
  return ret.result?.value;
 };
 await call('Page.enable');await call('Runtime.enable');
 for(const type of ['bautismo','confirmacion','matrimonio','exequias']){
  for(const size of ['letter','mobile']){
   const width=size==='letter'?1090:390,height=size==='letter'?1290:844;
   await call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,mobile:size==='mobile',deviceScaleFactor:1});
   const failuresBefore=exceptions.length;
   await call('Page.navigate',{url:'http://127.0.0.1:4845/?type='+type+(attack?'&xss=1':'')});
   let data;
   for(let i=0;i<60;i++){
    await sleep(120);
    data=await evaluate(`(()=>{const frame=document.querySelector('iframe');const doc=frame?.contentDocument||document;
     const body=(doc.querySelector('.sacramentum-document')||doc.body);
     const txt=body?.innerText||'';const html=body?.innerHTML||'';
     const root=document.querySelector('#root');
     return {type:window.__v195?.type||null,title:doc.title,text:txt.slice(0,8500),
     htmlLength:html.length,scrollHeight:body?.scrollHeight||0,clientHeight:body?.clientHeight||0,
     loaded:!!root?.firstChild,bodyHasText:txt.length>100,rootOverflow:document.documentElement.scrollWidth>innerWidth,
     injectedNodes:doc.querySelectorAll('img[onerror],svg[onload]').length,scriptExecuted:!!(window.__qaV195Injected||frame?.contentWindow?.__qaV195Injected),
     bodyWidth:body?.getBoundingClientRect().width||0};})()`);
    if(data?.type===type&&data?.bodyHasText)break;
   }
   if(!data?.bodyHasText){console.log('PAGE '+type+' '+size+' '+JSON.stringify(data));}
   const normalized=(data?.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
   const required=['31','442','888','BARRANQUILLA'];
   const legacy=['9999','9998','9997','PERSONA RAW ANTIGUA','NO ES TITULAR'];
   const titleWord={bautismo:'BAUTISMO',confirmacion:'CONFIRMACION',matrimonio:'MATRIMONIO',exequias:'EXEQUIAS'}[type];
   const missing=required.filter(x=>!normalized.includes(x));
   const leaks=legacy.filter(x=>normalized.includes(x));
   const passed=!!data?.bodyHasText&&normalized.includes(titleWord)&&missing.length===0&&leaks.length===0&&data.injectedNodes===0&&!data.scriptExecuted&&exceptions.length===failuresBefore;
   const capture=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
   const bytes=Buffer.from(capture.data,'base64');
   const filename='v195-'+(attack?'xss-':'')+type+'-'+size+'.png';fs.writeFileSync(path.join(evidence,filename),bytes);
   const r={type,size,width,height,passed,attack,injectedNodes:data?.injectedNodes,scriptExecuted:data?.scriptExecuted,missing,legacyLeaks:leaks,rootOverflow:data?.rootOverflow,
    htmlLength:data?.htmlLength,renderedChars:normalized.length,exceptionDelta:exceptions.length-failuresBefore,
    screenshot:filename,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    screenshotBytes:bytes.length,preview:normalized.slice(0,520)};
   results.push(r);
   console.log((passed?'PASS':'FAIL')+' '+type+'/'+size+' text='+normalized.length+' missing='+missing.join(',')+' leak='+leaks.join(',')+' screenshot='+bytes.length);
  }
 }
}finally{
 try{socket?.close()}catch{}
 try{browser.kill()}catch{}
 try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
}
const report={protocol:'V195',method:'Chrome CDP on real React sacramental print templates, isolated Vite fixture',
 limitation:'NO authenticated UI session, printer spool, or PostgreSQL E2E. All records are fabricated.',generatedAt:new Date().toISOString(),
 passed:results.filter(x=>x.passed).length,total:results.length,exceptions:exceptions.slice(0,15),results};
fs.writeFileSync(attack?'AUDITORIA_XSS_PARTIDAS_V195.json':'AUDITORIA_VISUAL_PARTIDAS_V195.json',JSON.stringify(report,null,2)+'\n');
console.log('V195 BROWSER SUMMARY '+report.passed+'/'+report.total+' errors='+exceptions.length);
if(report.passed!==8||exceptions.length)process.exitCode=1;
