// V249 · Chrome real sobre React auténtico y perfiles de pantalla ficticios (sin credenciales ni datos).
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const exe=[process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(fs.existsSync);
if(!exe)throw Error('Chrome/Edge not found');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const inv=JSON.parse(fs.readFileSync('AUDITORIA_RUTAS_ECLESIALES_V249.json','utf8'));
const routes=Object.fromEntries(['diocese','chancery','parish','admin_general'].map(role=>[
 role,[...new Set(inv.role_paths[role])].map(p=>p.replace(/:([A-Za-z_]+)/g,'00000000-0000-0000-0000-000000000001').replace(/\*/g,'historical'))
]));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v249-browser-'));
const dir=path.resolve('AUDITORIA_EVIDENCIA_VISUAL_V249');fs.mkdirSync(dir,{recursive:true});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v249-visual/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
const flags=process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[];
const chrome=spawn(exe,[...flags,'--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
let socket,seq=0;const pending=new Map(),rows=[],errors=[];
try{
 let ready=false;
 for(let i=0;i<120;i++){
   try{ready=(await fetch('http://127.0.0.1:4897/')).ok}catch{}
   if(ready)break;
   await sleep(100);
 }
 if(!ready)throw Error('V249 isolated Vite visual fixture unavailable');
 const portfile=path.join(temp,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Chrome CDP startup failed');
 const [port]=fs.readFileSync(portfile,'utf8').split(/\r?\n/);
 const target=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(x=>x.type==='page');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true})});
 socket.addEventListener('message',ev=>{
  let x;try{x=JSON.parse(ev.data)}catch{return}
  if(x.method==='Runtime.exceptionThrown')errors.push(x.params?.exceptionDetails?.exception?.description||'JS exception');
  if(x.id&&pending.has(x.id)){const p=pending.get(x.id);pending.delete(x.id);x.error?p.bad(Error(x.error.message)):p.ok(x.result||{});}
 });
 const call=(method,params={})=>new Promise((ok,bad)=>{const id=++seq;pending.set(id,{ok,bad});socket.send(JSON.stringify({id,method,params}));});
 await call('Page.enable');await call('Runtime.enable');
 const expression=[
 '(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode().catch(()=>{})));',
 'const root=document.querySelector(".ecclesial-workspace");',
 'const side=document.querySelector(".ecclesial-sidebar");',
 'const crest=side?.querySelector("img[src*=archdiocese]");',
 'return {role:document.querySelector("[data-ecclesial-role]")?.getAttribute("data-ecclesial-role")||"admin_general",',
 'ecclesial:!!root,sidebar:!!side,header:!!document.querySelector(".ecclesial-header"),',
 'intro:!!document.querySelector(".ecclesial-context"),cards:document.querySelectorAll(".sacramentum-panel").length,',
 'table:!!document.querySelector(".sacramentum-table-shell"),form:!!document.querySelector(".sacramentum-form-shell"),',
 'crestReady:!!crest?.naturalWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,',
 'fixture:!!document.querySelector("[data-v249-fixture]"),title:document.querySelector("h1")?.textContent?.trim()};})()'
 ].join('');
 for(const [role,paths] of Object.entries(routes)){
  for(const viewport of [{name:'desktop',w:1365,h:900,mobile:false},{name:'mobile',w:390,h:844,mobile:true}]){
   await call('Emulation.setDeviceMetricsOverride',{width:viewport.w,height:viewport.h,screenWidth:viewport.w,screenHeight:viewport.h,deviceScaleFactor:1,mobile:viewport.mobile});
   for(let i=0;i<paths.length;i++){
    const route=paths[i],url='http://127.0.0.1:4897'+route+'?role='+role;
    const before=errors.length;await call('Page.navigate',{url});await sleep(i===0?950:450);
    let info={};
    for(let attempt=0;attempt<24;attempt++){
      const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));
      info=r.result?.value||{};
      if(info.fixture&&(!info.ecclesial||info.crestReady))break;
      await sleep(120);
    }
    const admin=role==='admin_general';
    const passed=!!info.fixture&&!info.overflow&&errors.length===before &&
      (admin?(!info.ecclesial&&!info.sidebar&&!info.header&&!info.intro):
      (info.ecclesial&&info.sidebar&&info.header&&info.intro&&info.role===role&&info.cards===3&&info.table&&info.form&&info.crestReady));
    const item={role,route,viewport:viewport.name,...info,passed,newErrors:errors.length-before};rows.push(item);
    if(i===0){
     const img=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
     const name='v249-'+role+'-'+viewport.name+'.png';fs.writeFileSync(path.join(dir,name),Buffer.from(img.data,'base64'));item.screenshot=name;
    }
    if(!passed)console.log('FAIL '+JSON.stringify(item).slice(0,500));
   }
   console.log('ROLE '+role+'/'+viewport.name+' passed '+rows.filter(x=>x.role===role&&x.viewport===viewport.name&&x.passed).length+'/'+paths.length);
  }
 }
}finally{try{socket?.close()}catch{}try{chrome.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(temp,{recursive:true,force:true})}catch{}}
const passed=rows.filter(x=>x.passed).length,approved=passed===rows.length&&errors.length===0;
const report={protocol:'V249',method:'Chrome real sobre DashboardLayout, Sidebar y Header reales; identidad y contenido aislados por mocks; sin iniciar sesión real',approved,checked:rows.length,passed,failed:rows.length-passed,exceptions:errors.length,rows};
fs.writeFileSync('AUDITORIA_VISUAL_TRES_ROLES_V249.json',JSON.stringify(report,null,2)+'\n');
console.log('V249 VISUAL '+(approved?'PASS':'FAIL')+' '+passed+'/'+rows.length);
if(!approved)process.exitCode=1;
