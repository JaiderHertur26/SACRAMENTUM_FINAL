// V119 · Prueba visual REAL del navegador SIN sesión (no simula credenciales ni altera datos).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://127.0.0.1:4813';
const evidence = 'C:\\SACRAMENTUM\\SACRAMENTUM_FINAL\\AUDITORIA_EVIDENCIA_VISUAL_V119';
if(!fs.existsSync(chrome))throw Error('Chrome no disponible.');
fs.mkdirSync(evidence,{recursive:true});
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v119-'));
const child=spawn(chrome,[
  '--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
  '--disable-background-networking','--no-default-browser-check',
  '--remote-debugging-port=0','--user-data-dir='+folder,'about:blank'
],{stdio:'ignore'});
const sleep=t=>new Promise(ok=>setTimeout(ok,t));
const results=[];
let ws;
try{
  const f=path.join(folder,'DevToolsActivePort');
  for(let k=0;k<60&&!fs.existsSync(f);k++)await sleep(100);
  if(!fs.existsSync(f))throw Error('CDP Chrome no responde');
  const [port]=fs.readFileSync(f,'utf8').trim().split(/\r?\n/);
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  const page=targets.find(t=>t.type==='page');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  let id=0;
  const pending=new Map();
  ws.addEventListener('message',e=>{
    let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(msg.id&&pending.has(msg.id)){
      const p=pending.get(msg.id);pending.delete(msg.id);
      msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result||{});
    }
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const n=++id;pending.set(n,{resolve,reject});
    ws.send(JSON.stringify({id:n,method,params}));
  });
  await call('Page.enable');
  await call('Runtime.enable');
  const errors=[];
  ws.addEventListener('message',e=>{
    let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(msg.method==='Runtime.exceptionThrown'){
      errors.push(msg.params?.exceptionDetails?.exception?.description||msg.params?.exceptionDetails?.text||'Uncaught');
    }
  });
  const screens=[
    {id:'public-desktop',url:'/',w:1440,h:900,public:true},
    {id:'public-mobile',url:'/',w:390,h:844,public:true},
    {id:'login-mobile',url:'/login',w:390,h:844,public:true},
    {id:'chancery-guard',url:'/chancery/decretos',w:1440,h:900,guard:true},
    {id:'chancery-archive-guard',url:'/chancery/decretos/archivo',w:390,h:844,guard:true},
    {id:'diocese-guard',url:'/diocese/decretos/archivo',w:1440,h:900,guard:true},
    {id:'parish-guard',url:'/parroquia/decretos/archivo',w:390,h:844,guard:true}
  ];
  for(const c of screens){
    await call('Emulation.setDeviceMetricsOverride',{
      width:c.w,height:c.h,deviceScaleFactor:1,mobile:c.w<600,screenWidth:c.w,screenHeight:c.h
    });
    const before=errors.length;
    await call('Page.navigate',{url:base+c.url});
    // Esperar al render React y a la ruta final; un Vite frío puede tardar en optimizar dependencias.
    for(let attempt=0;attempt<35;attempt++) {
      await sleep(300);
      const loaded=await call('Runtime.evaluate',{
        expression:"({loaded:document.querySelector('#root')?.innerText?.length||0,ready:document.readyState,href:location.href})",
        returnByValue:true
      });
      if((loaded.result?.value?.loaded||0)>50&&loaded.result?.value?.ready==='complete')break;
    }
    const ev=await call('Runtime.evaluate',{
      expression:`JSON.stringify({href:location.href,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rootLen:document.querySelector('#root')?.innerText?.length||0, heading:document.querySelector('h1')?.innerText||'', body:document.body.innerText.slice(0,1000), passwordInputs:document.querySelectorAll('input[type=password]').length})`,
      returnByValue:true
    });
    const metrics=JSON.parse(ev.result?.value||'{}');
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const binary=Buffer.from(shot.data,'base64');
    const filename=c.id+'.png';
    fs.writeFileSync(path.join(evidence,filename),binary);
    const bounced=metrics.href.endsWith(c.url)===false;
    const noRuntimeErrors=errors.length===before;
    // Un usuario anónimo nunca debe ver el archivo privado, aun cuando la app redirija o permanezca en carga.
    const protectedText=/Centro de Decretos Sacramentales|Conciliación de decretos antiguos|ANULACION · Fuentes históricas|Archivo de Decretos Parroquiales/i;
    const exposed=c.guard&&protectedText.test(metrics.body);
    const passed=metrics.width===c.w&&metrics.rootLen>50&&!exposed&&noRuntimeErrors
      &&(!c.public || metrics.scrollWidth<=c.w+2);
    const out={...c,metrics:{...metrics,body:metrics.body.slice(0,420)},redirected:bounced,
      noRuntimeErrors,exposed,passed,filename,sha256:crypto.createHash('sha256').update(binary).digest('hex')};
    results.push(out);
    console.log((passed?'PASS ':'FAIL ')+c.id+' '+JSON.stringify({
      url:metrics.href,rendered:metrics.rootLen,overflow:metrics.scrollWidth>c.w+2,
      redirected:bounced,errors:errors.slice(before).length,exposed
    }));
  }
}finally{
  try{ws?.close()}catch{}
  try{child.kill()}catch{}
}
const report={date:new Date().toISOString(),scope:'Chrome headless LOCAL, navegación sin autenticación real',tests:results,
  passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,
  note:'No prueba las pantallas autenticadas. Capturas y métricas de sesión anónima solamente.'};
fs.writeFileSync('AUDITORIA_NAVEGADOR_ANONIMO_V119.json',JSON.stringify(report,null,2)+'\n');
console.log('BROWSER SUMMARY '+report.passed+'/'+results.length);
if(report.failed)process.exitCode=2;
