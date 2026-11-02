// V325 · Pantallas reales; datos, identidad y servicios de ensayo aislados.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const exe=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(fs.existsSync);
if(!exe)throw Error('Chrome/Edge no disponible');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base='http://127.0.0.1:4915';
const folder=path.resolve('AUDITORIA_EVIDENCIA_DECRETOS_V325');fs.mkdirSync(folder,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v325-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v325-decrees/vite.config.mjs'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let viteOutput='';for(const stream of [vite.stdout,vite.stderr])stream?.on('data',data=>{viteOutput=(viteOutput+data).slice(-4000)});
let chrome,socket,seq=0;const pending=new Map(),checks=[],screens=[],exceptions=[],externalRequests=[];
const check=(ok,name,details={})=>{checks.push({name,passed:!!ok,...details});if(!ok)throw Error(name+' '+JSON.stringify(details));};
let call,evaluate;
try{
 let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(base)).ok}catch{}if(ready)break;await pause(100);}
 if(!ready)throw Error('No inició la muestra Vite: '+viteOutput);
 chrome=spawn(exe,[...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),'--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore',windowsHide:true});
 const portfile=path.join(temp,'DevToolsActivePort');
 for(let i=0;i<180&&!fs.existsSync(portfile)&&chrome.exitCode===null;i++)await pause(100);
 if(!fs.existsSync(portfile))throw Error('Chrome no inició CDP');
 const [port]=fs.readFileSync(portfile,'utf8').split(/\r?\n/);
 const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(x=>x.type==='page');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true});});
 call=(method,params={})=>new Promise((ok,bad)=>{const id=++seq;pending.set(id,{ok,bad});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',async event=>{
  let msg;try{msg=JSON.parse(event.data)}catch{return}
  if(msg.method==='Network.loadingFailed')console.log('FAIL',JSON.stringify(msg.params));
  if(msg.method==='Log.entryAdded')console.log('LOG',JSON.stringify(msg.params.entry));
  if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')console.log('CONSOLE',JSON.stringify(msg.params.args));
  if(msg.method==='Network.responseReceived'&&msg.params.response.status>=400)console.log('HTTP',msg.params.response.status,msg.params.response.url);
  if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.exception?.description||'Excepción JavaScript');
  if(msg.method==='Fetch.requestPaused'){
   const url=msg.params.request.url;
   if(/^https?:/.test(url)&&new URL(url).origin!==base){
    externalRequests.push(url);await call('Fetch.failRequest',{requestId:msg.params.requestId,errorReason:'BlockedByClient'});
   }else await call('Fetch.continueRequest',{requestId:msg.params.requestId});
  }
  if(msg.id&&pending.has(msg.id)){const task=pending.get(msg.id);pending.delete(msg.id);msg.error?task.bad(Error(msg.error.message)):task.ok(msg.result||{});}
 });
 await call('Log.enable');await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 evaluate=async expression=>{
  const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails).slice(0,650));
  return result.result?.value;
 };

 const open=async(query,ready)=>{
  await call('Page.navigate',{url:base+'/?'+query});
  for(let i=0;i<300;i++){if(await evaluate('!!document.body && ('+ready+')'))return;await pause(100);}
  throw Error('No cargó '+query+': '+viteOutput+' '+await evaluate('JSON.stringify({url:location.href,text:document.body.textContent.slice(0,1000),qa:window.__qa325,state:document.readyState})'));
 };
 const clickText=async text=>{await evaluate('[...document.querySelectorAll("button")].find(x=>x.textContent.includes('+JSON.stringify(text)+')).click()');await pause(100);};
 for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  await call('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:false});
  await open('screen=baptism','document.body.textContent.includes("Individual (1)")');
  let text=await evaluate('document.body.textContent');
  check(!text.includes('DECRETO_UNO')&&!text.includes('DECRETO_DOS'),'Bautismos excluye ambos decretos',{viewport:viewport.name});
  check(text.includes('Individual (1)')&&text.includes('Por Lote (1)')&&text.includes('Historial (1)'),'Conteos solo de boletas ordinarias',{viewport:viewport.name});
  check(await evaluate('!!document.querySelector(\'a[href="/parroquia/decretos?view=asiento"]\')'),'Acceso separado a decretos',{viewport:viewport.name});
  await clickText('Por Lote');
  text=await evaluate('document.body.textContent');
  check(text.includes('ORDINARIO_PENDIENTE')&&!text.includes('DECRETO_'),'Lote solo ordinario',{viewport:viewport.name});
  await clickText('Reportadas / Historial');
  text=await evaluate('document.body.textContent');
  check(text.includes('ORDINARIO_SENTADO')&&!text.includes('DECRETO_'),'Historial excluye decreto sentado por error',{viewport:viewport.name});
  check(await evaluate('window.__qa325.legacyCalls.length===0&&window.__qa325.decreeCalls.length===0'),'Consultar bandejas no asienta',{viewport:viewport.name});
  await open('screen=queue','document.querySelectorAll("article").length===2');
  text=await evaluate('document.body.textContent');
  check(text.includes('Decreto 001')&&text.includes('Decreto 002'),'Bandeja propia conserva dos decretos pendientes',{viewport:viewport.name});
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'Bandeja de decretos adaptable',{viewport:viewport.name});
  const img=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const file='v325-queue-'+viewport.name+'.png';fs.writeFileSync(path.join(folder,file),Buffer.from(img.data,'base64'));screens.push({file,viewport:viewport.name});
  await clickText('Leer decreto y sentar');
  check(await evaluate('document.querySelector("[data-destination]")?.textContent==="/parish/decrees/00000000-0000-4000-8000-000000000021"'),'Abrir lleva al detalle legal del decreto',{viewport:viewport.name});
  check(await evaluate('window.__qa325.decreeCalls.length===0'),'Abrir decreto no ejecuta asiento',{viewport:viewport.name});
  await open('screen=decree','document.querySelectorAll(\'input:not([type="checkbox"])\').length===4');
  check(await evaluate('[...document.querySelectorAll(\'input:not([type="checkbox"])\')].every(x=>x.value==="")'),'Coordenadas y capacidad se solicitan vacías',{viewport:viewport.name});
  check(await evaluate('[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Sentar Decreto y enviar acuse"))?.disabled'),'No se puede sentar sin coordenadas',{viewport:viewport.name});
  for(const [index,value] of ['0001A','7','13','2'].entries()){
   await evaluate('document.querySelectorAll(\'input:not([type="checkbox"])\')['+index+'].focus()');
   await call('Input.insertText',{text:value});
  }
  await clickText('Sentar Decreto y enviar acuse');
  const calls=await evaluate('window.__qa325');
  check(calls.decreeCalls.length===1&&calls.legacyCalls.length===0,'Un solo asiento usa RPC propio de decreto',{viewport:viewport.name});
  const params=calls.decreeCalls[0];
  check(params.p_book_code==='0001A'&&params.p_folio===7&&params.p_number===13&&params.p_partidas_per_folio===2,'Asiento recibe exactamente las coordenadas escritas',{viewport:viewport.name});
  await open('screen=decree&second=1','document.body.textContent.includes("Orden bloqueado")');
  check(await evaluate('document.querySelectorAll(\'input:not([type="checkbox"])\').length===0&&window.__qa325.decreeCalls.length===0'),'Segundo decreto espera al primero',{viewport:viewport.name});
  await open('screen=queue&fail=1','!!document.querySelector("[role=alert]")');
  check(await evaluate('!document.body.textContent.includes("No hay decretos pendientes")'),'Error de lectura no simula bandeja vacía',{viewport:viewport.name});
 }
 check(exceptions.length===0,'Cero excepciones JavaScript',{exceptions:exceptions.length});
 check(externalRequests.length===0,'Cero solicitudes a servicios externos',{externalRequests:externalRequests.length});
}catch(error){
 checks.push({name:'Finalización del ensayo',passed:false,error:error.message});
 console.error(error.stack);
 if(call){try{const img=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,'failure.png'),Buffer.from(img.data,'base64'));}catch{}}
}finally{
 try{socket?.close()}catch{}try{chrome?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(temp,{recursive:true,force:true})}catch{}
}

const sourcePaths=["src/domain/pendingOriginV325.mjs","src/components/parish/ParishDecreeQueueV325.jsx","src/components/DecreeSeatingLinkV325.jsx","src/pages/parish/BaptismSentarRegistrosPage.jsx","src/components/parish/ParishDecreeSeatPanelV280.jsx","src/services/decreeSeatsV280.js","scripts/qa-v325-decrees/index.html","scripts/qa-v325-decrees/vite.config.mjs","scripts/qa-v325-decrees/mockComponent.jsx","scripts/qa-v325-decrees/mocks.jsx","scripts/qa-v325-decrees/entry.jsx","scripts/audit-decree-pending-browser-v325.mjs"];
const source_sha256_lf=Object.fromEntries(sourcePaths.map(file=>[file,createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const passed=checks.filter(x=>x.passed).length;
const report={protocol:'V325',testedAt:new Date().toISOString(),source_sha256_lf,method:'Chrome real; pantallas reales con servicios y datos ficticios aislados',approved:passed===checks.length,checked:checks.length,passed,failed:checks.length-passed,exceptions,externalRequests,screens,checks};
fs.writeFileSync('AUDITORIA_DECRETOS_PENDIENTES_V325.json',JSON.stringify(report,null,2)+'\n');
console.log('V325 DECRETOS '+(report.approved?'PASS':'FAIL')+' '+passed+'/'+checks.length);
if(!report.approved)process.exitCode=1;
