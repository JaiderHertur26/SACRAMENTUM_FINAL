// V324 · Pantallas reales; datos, identidad y servicios de ensayo aislados.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import {COMMAND_CENTERS} from '../src/config/commandCenters.js';
import {createHash} from 'node:crypto';
const exe=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(fs.existsSync);
if(!exe)throw Error('Chrome/Edge no disponible');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base='http://127.0.0.1:4914',paths={parish:'/parish/dashboard',diocese:'/diocese/dashboard',chancery:'/chancery/dashboard',admin_general:'/admin/dashboard'};
const folder=path.resolve('AUDITORIA_EVIDENCIA_CENTROS_V324');fs.mkdirSync(folder,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v324-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v324-command/vite.config.mjs'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
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
  if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.exception?.description||'Excepción JavaScript');
  if(msg.method==='Fetch.requestPaused'){
   const url=msg.params.request.url;
   if(/^https?:/.test(url)&&new URL(url).origin!==base){
    externalRequests.push(url);await call('Fetch.failRequest',{requestId:msg.params.requestId,errorReason:'BlockedByClient'});
   }else await call('Fetch.continueRequest',{requestId:msg.params.requestId});
  }
  if(msg.id&&pending.has(msg.id)){const task=pending.get(msg.id);pending.delete(msg.id);msg.error?task.bad(Error(msg.error.message)):task.ok(msg.result||{});}
 });
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 evaluate=async expression=>{
  const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails).slice(0,650));
  return result.result?.value;
 };
 const load=async(role,fail=false)=>{
  await call('Page.navigate',{url:base+paths[role]+'?role='+role+(fail?'&fail=1':'')});
  for(let i=0;i<180;i++){
   if(await evaluate('!!document.querySelector("[data-command-center-role]") && document.querySelector(".cc-metrics")?.getAttribute("aria-busy")==="false"'))return;
   await pause(100);
  }
  throw Error('No cargó el centro '+role+': '+viteOutput);
 };
 const viewportList=[{name:'desktop',width:1440,height:1040},{name:'small-desktop',width:1024,height:900},{name:'tablet',width:820,height:1180},{name:'mobile',width:390,height:844},{name:'small-mobile',width:320,height:740}];
 for(const role of Object.keys(paths).filter(role=>!process.argv.some(x=>x.startsWith('--role='))||process.argv.includes('--role='+role))){
  for(const viewport of viewportList.filter(viewport=>!process.argv.some(x=>x.startsWith('--viewport='))||process.argv.includes('--viewport='+viewport.name))){
   await call('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:false});
   await load(role);await pause(250);
   const info=await evaluate('(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));return {role:document.querySelector("[data-command-center-role]")?.dataset.commandCenterRole,title:document.querySelector("h1")?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+2,modules:document.querySelectorAll(".cc-module").length,metrics:document.querySelectorAll(".cc-metric").length,ecclesial:!!document.querySelector(".ecclesial-workspace .ecclesial-sidebar"),header:!!document.querySelector(".ecclesial-header"),writes:window.__V324_QA.writes.length,overflowing:[...document.querySelectorAll("main *")].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(-8).map(el=>({tag:el.tagName,classes:el.className?.toString().slice(0,130),width:Math.round(el.getBoundingClientRect().width),text:el.textContent.slice(0,80)})),wine:getComputedStyle(document.querySelector(".ecclesial-command-center")).getPropertyValue("--cc-wine").trim()};})()');
   check(info.role===role&&info.title==='Centro de mando'&&info.ecclesial&&info.header&&info.wine==='#682b3e','Identidad eclesial por rol',{role,viewport:viewport.name});
   check(!info.overflow,'Sin desbordamiento horizontal',{role,viewport:viewport.name,overflowing:info.overflowing});
   check(info.modules===COMMAND_CENTERS[role].modules.length&&info.metrics===({parish:5,diocese:3,chancery:4,admin_general:4}[role]),'Áreas y resumen del rol',{role,viewport:viewport.name});
   check(info.writes===0,'Carga sin escrituras',{role,viewport:viewport.name});
   for(const module of COMMAND_CENTERS[role].modules){
    await evaluate('document.querySelectorAll(".cc-module")['+COMMAND_CENTERS[role].modules.indexOf(module)+'].click()');
    await pause(65);
    const panel=await evaluate('({title:document.querySelector(".cc-action-panel h2")?.textContent,focused:document.activeElement===document.querySelector(".cc-action-panel h2"),links:[...document.querySelectorAll(".cc-action-panel a")].map(a=>a.getAttribute("href"))})');
    check(panel.title===module.label&&panel.focused&&JSON.stringify(panel.links)===JSON.stringify(module.actions.map(x=>x.to)),'Panel de acciones y foco',{role,viewport:viewport.name,module:module.id});
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await pause(40);
    const restored=await evaluate('!document.querySelector(".cc-action-panel") && document.activeElement?.classList.contains("cc-module")');
    check(restored,'Escape cierra y devuelve el foco',{role,viewport:viewport.name,module:module.id});
   }
   if(['desktop','mobile'].includes(viewport.name)){
    await evaluate('document.querySelector(".cc-module").click()');await pause(80);await evaluate('window.scrollTo(0,0)');
    const img=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const file='v324-'+role+'-'+viewport.name+'.png';fs.writeFileSync(path.join(folder,file),Buffer.from(img.data,'base64'));
    screens.push({role,viewport:viewport.name,file,...info});
   }
   if(viewport.name==='desktop'){
    if(role==='chancery'){
     await evaluate('[...document.querySelectorAll(".cc-shortcuts button")].find(x=>x.textContent.includes("Configurar membrete")).click()');await pause(100);
     check(await evaluate('!![...document.querySelectorAll("h3")].find(x=>x.textContent==="Configuración de Identidad Legal")?.closest(".fixed")?.querySelector("form")'),'Membrete conserva su formulario');
     await evaluate('[...document.querySelectorAll("form button")].find(x=>x.textContent.trim()==="Cancelar").click()');
     check(await evaluate('window.__V324_QA.writes.length===0'),'Cancelar membrete no guarda datos');
    }
    await evaluate('document.querySelector(".cc-search").click()');await pause(80);
    check(await evaluate('document.querySelector("[data-qa-destination]")?.textContent==="/buscar"'),'Búsqueda abre la pantalla existente',{role});
    await load(role);
    await evaluate('document.querySelector(".cc-module").click()');await pause(60);
    const expected=COMMAND_CENTERS[role].modules[0].actions[0].to;
    await evaluate('document.querySelector(".cc-action-panel a").click()');await pause(80);
    check(await evaluate('document.querySelector("[data-qa-destination]")?.textContent==='+JSON.stringify(expected)),'Acción navega a su destino existente',{role});
   }
   console.log('V324 '+role+'/'+viewport.name+' OK');
  }
 }
 for(const role of ['parish','diocese','chancery','admin_general']){
  await load(role,true);
  check(await evaluate('!!document.querySelector(".cc-error") && [...document.querySelectorAll(".cc-metric strong")].every(x=>x.textContent==="—")'),'Lectura fallida no presenta ceros como datos',{role});
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
const sourcePaths=["src/config/commandCenters.js","src/components/EcclesialCommandCenter.jsx","src/styles/command-center.css","src/pages/parish/ParishDashboard.jsx","src/pages/diocese/DioceseUserDashboard.jsx","src/pages/chancery/ChanceryDashboard.jsx","src/pages/admin/AdminGeneralDashboard.jsx","src/components/DashboardLayout.jsx","src/components/Sidebar.jsx","src/components/Header.jsx","scripts/qa-v324-command/entry.jsx","scripts/qa-v324-command/mocks.jsx","scripts/qa-v324-command/vite.config.mjs","scripts/audit-command-centers-browser-v324.mjs"];
const source_sha256_lf=Object.fromEntries(sourcePaths.map(file=>[file,createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const passed=checks.filter(x=>x.passed).length;
const report={protocol:'V324',testedAt:new Date().toISOString(),source_sha256_lf,method:'Chrome real; cuatro dashboards, DashboardLayout, Sidebar y Header reales; perfiles y servicios ficticios aislados; sin iniciar sesiones institucionales ni escribir datos',approved:passed===checks.length&&exceptions.length===0&&externalRequests.length===0,checked:checks.length,passed,failed:checks.length-passed,exceptions,externalRequests,screens,checks};
fs.writeFileSync('AUDITORIA_CENTROS_DE_MANDO_V324.json',JSON.stringify(report,null,2)+'\n');
console.log('V324 CENTROS '+(report.approved?'PASS':'FAIL')+' '+passed+'/'+checks.length);
if(!report.approved)process.exitCode=1;
