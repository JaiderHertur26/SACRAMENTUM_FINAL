// V175: Real Chrome, real production build, isolated clean anonymous profile.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const app=fs.readFileSync('src/App.jsx','utf8').replace(/^\uFEFF/,'');
const chunks=app.split(/(?=<Route\b)/).slice(1);
const raw=chunks.map(c=>({
 path:c.match(/^\s*<Route\s+[\s\S]*?\bpath="([^"]+)"/)?.[1],
 guarded:/\belement\s*=\s*\{\s*<ProtectedRoute\b/.test(c.slice(0,550)),
 redirected:/\belement\s*=\s*\{\s*<Navigate\b/.test(c.slice(0,550))
})).filter(x=>x.path&&!['/','/login','/404','*','/account-configuration-error'].includes(x.path));
const unique=[...new Map(raw.map(x=>[x.path,x])).values()];
if(unique.length<60)throw Error('Too few routes discovered: '+unique.length);
if(unique.some(x=>!x.guarded&&!x.redirected))throw Error('Route lacks access guard or redirect: '+JSON.stringify(unique.filter(x=>!x.guarded&&!x.redirected)));
const base=process.env.V175_BASE_URL||'http://127.0.0.1:4813';
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v175-anon-'));
const child=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+folder,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws;const results=[];const exceptions=[];
try{
 const portfile=path.join(folder,'DevToolsActivePort');
 for(let i=0;i<80&&!fs.existsSync(portfile);i++)await sleep(100);
 if(!fs.existsSync(portfile))throw Error('Chrome CDP unavailable');
 const [port]=fs.readFileSync(portfile,'utf8').trim().split(/\r?\n/);
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
 let seq=0;const pending=new Map();
 ws.addEventListener('message',event=>{
  let m;try{m=JSON.parse(event.data)}catch{return}
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params?.exceptionDetails?.exception?.description||m.params?.exceptionDetails?.text||'JS exception');
 });
 const call=(method,params={})=>new Promise((yes,no)=>{const id=++seq;pending.set(id,{resolve:yes,reject:no});ws.send(JSON.stringify({id,method,params}))});
 const expression="(()=>({path:location.pathname,rootLen:document.querySelector('#root')?.innerText?.length||0,hasLoginButton:document.querySelectorAll('form').length>0,passwordCount:document.querySelectorAll('input[type=password]').length,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,hasSession:localStorage.getItem('sb-foczofcmwampjvlfbsqn-auth-token')!==null}))()";
 const state=async()=>{
  const r=await call('Runtime.evaluate',{returnByValue:true,expression});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.text||'eval failure');
  return r.result?.value;
 };
 await call('Page.enable');await call('Runtime.enable');
 for(let i=0;i<unique.length;i++){
  const spec=unique[i],mobile=i%5===0,w=mobile?390:1365,h=mobile?844:900;
  await call('Emulation.setDeviceMetricsOverride',{width:w,height:h,mobile,screenWidth:w,screenHeight:h,deviceScaleFactor:1});
  const url=base+spec.path.replace(/:([A-Za-z0-9_]+)/g,'00000000-0000-0000-0000-000000000001').replace(/\*/g,'historical');
  const prevErrors=exceptions.length;let st,reason='';
  try{
   await call('Page.navigate',{url});
   for(let tries=0;tries<35;tries++){await sleep(110);st=await state();if(st.path==='/'&&st.hasLoginButton&&st.passwordCount>0)break;}
   const passed=st?.path==='/'&&st?.hasLoginButton&&st?.passwordCount>0&&!st?.hasSession&&st?.scrollWidth<=st?.viewport+2&&exceptions.length===prevErrors;
   results.push({path:spec.path,type:spec.guarded?'protected':'alias',mobile,passed,finalPath:st?.path,redirected:st?.path==='/',loginVisible:st?.hasLoginButton,horizontalOverflow:st?.scrollWidth>st?.viewport+2,errors:exceptions.length-prevErrors});
   if(!passed)console.log('FAIL '+spec.path+' '+JSON.stringify(st));
  }catch(e){reason=String(e.message||e).slice(0,500);results.push({path:spec.path,type:spec.guarded?'protected':'alias',mobile,passed:false,error:reason});console.log('ERROR '+spec.path+' '+reason)}
  if((i+1)%15===0)console.log('PROGRESS '+(i+1)+'/'+unique.length+' PASSED='+results.filter(x=>x.passed).length);
 }
}finally{try{ws?.close()}catch{}try{child.kill()}catch{}try{fs.rmSync(folder,{recursive:true,force:true})}catch{}}
const report={protocol:'V175',at:new Date().toISOString(),method:'Chrome headless with locally built Vite preview, new anonymous browser and live React routing',scope:'No real user session; tests protected and aliased routes do not expose private UI. Does not certify authenticated CRUD.',sourceRouteCount:unique.length,guarded:unique.filter(x=>x.guarded).length,aliases:unique.filter(x=>x.redirected).length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,exceptions:exceptions.slice(0,12),results};
fs.writeFileSync(base.startsWith('https:')?'AUDITORIA_RUTAS_PRODUCCION_V175.json':'AUDITORIA_RUTAS_ANONIMAS_V175.json',JSON.stringify({...report,base,environment:base.startsWith('https:')?'vercel-production':'local-preview'},null,2)+'\n');
console.log('V175_ROUTE_SUMMARY '+report.passed+'/'+report.sourceRouteCount+' failed='+report.failed);
if(report.failed)process.exitCode=1;