import {parse} from '@babel/parser';
// Actual complete application, actual login form, genuine GoTrue accounts, real RLS.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const config=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
// V209 targets only detail paths. Never clicks forms, mutates records or prints private data.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v208-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/qa-v208-app/vite.config.mjs'],{stdio:'ignore',windowsHide:true});
let browser,socket;const rows=[],exceptions=[],externalRequests=[];
try{
 let ready=false;for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:4859/')).ok}catch{}if(ready)break;await sleep(100)}if(!ready)throw Error('Vite unavailable');
 // Hosted Linux runners can restrict Chromium user namespaces; this browser only serves isolated fake data.
 const platformFlags=process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[];
 let chromeDiagnostics='';
 browser=spawn(chrome,[...platformFlags,'--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',chunk=>{chromeDiagnostics=(chromeDiagnostics+chunk.toString()).slice(-2400)});
 browser.on('error',error=>{chromeDiagnostics=error.message});
 const portfile=path.join(tmp,'DevToolsActivePort');
 for(let i=0;i<300&&!fs.existsSync(portfile);i++){if(browser.exitCode!==null||browser.signalCode)break;await sleep(100)}
 if(!fs.existsSync(portfile))throw Error('Chrome startup failed (exit='+browser.exitCode+'): '+chromeDiagnostics);
 let port;for(let retry=0;retry<50;retry++){try{const candidate=fs.readFileSync(portfile,'utf8').split(/\r?\n/)[0];if(/^\d+$/.test(candidate)){port=candidate;break}}catch{}await sleep(50)}if(!port)throw Error('Chrome debugging port unavailable');
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 const pending=new Map();let seq=0;
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id,method,params}))});
 socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);m.error?cb.reject(Error(m.error.message)):cb.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||'JS exception');
  if(m.method==='Fetch.requestPaused'){
   const url=m.params.request.url;
   if(!url.startsWith('http://127.0.0.1:4859/')&&!url.startsWith(config.url+'/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("({path:location.pathname,text:(document.querySelector('#root')?.textContent||'').slice(0,6000),documentReady:document.readyState,emailInput:!!document.querySelector('input[type=email]')})");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<300;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});




 const ast=parse(fs.readFileSync('src/App.jsx','utf8'),{sourceType:'module',plugins:['jsx']}),routes=[];
 const visit=node=>{if(!node||typeof node!=='object')return;
  if(node.type==='JSXElement'&&node.openingElement.name.name==='Route'){
   const attrs=node.openingElement.attributes,p=attrs.find(x=>x.name?.name==='path')?.value?.value,element=attrs.find(x=>x.name?.name==='element')?.value?.expression;
   if(p&&element?.openingElement?.name?.name==='ProtectedRoute'){
    const role=element.openingElement.attributes.find(x=>x.name?.name==='requiredRole')?.value?.expression;
    const roleName=role?.type==='MemberExpression'?role.property.name:null;
    const page=element.children.find(x=>x.type==='JSXElement')?.openingElement?.name?.name;
    routes.push({path:p,role:roleName,page,dynamic:p.includes(':')});
   }
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 };visit(ast);
 const accounts=['parish_a1','diocese_a','chancery','admin_general'].map(k=>config.users.find(a=>a.kind===k));
 for(const account of accounts){
  await call('Page.navigate',{url:'http://127.0.0.1:4859/'});await waitFor(s=>s.emailInput,'login form');
  await evaluate('localStorage.clear()');await call('Page.reload',{ignoreCache:true});await sleep(350);await waitFor(s=>s.emailInput,'anonymous');
  const fill=(type,value)=>evaluate("(()=>{const el=document.querySelector('input[type="+type+"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,"+JSON.stringify(value)+");el.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
  await fill('email',account.email);await fill('password',account.password);await evaluate("document.querySelector('input[type=password]').closest('form').requestSubmit()");
  const dashboard='/'+(account.role==='admin_general'?'admin':account.role)+'/dashboard';await waitFor(s=>s.path===dashboard&&s.text.length>100,'dashboard');
  const canonical={parish:'PARISH',diocese:'DIOCESE',chancery:'CHANCERY',admin_general:'ADMIN_GENERAL'}[account.role];
  // Both malformed and syntactically valid nonexistent IDs must fail closed.
  const targets=routes.filter(r=>r.dynamic).flatMap(r=>[
   { ...r, case:'missing', path:r.path.replace(/:[^/]+/, '00000000-0000-4000-8000-000000000000') },
   { ...r, case:'malformed', path:r.path.replace(/:[^/]+/, 'invalid-id-forbidden') }
  ]);
  for(const target of targets){
   const failures=[],before=exceptions.length,start=Date.now();let final;
   try{
    await call('Page.navigate',{url:'http://127.0.0.1:4859'+target.path});
    const allowed=account.role==='parish';
    final=await waitFor(s=>s.documentReady==='complete' && (allowed
      ? s.path===target.path&&(/Partida no disponible|Decreto no disponible/.test(s.text))
      : s.path===dashboard&&s.text.length>100&&!s.text.includes('Validando bóveda segura')),'dynamic guard '+target.path);
    await sleep(150);final=await state();
    if(account.role==='parish') {
     if(final.path!==target.path)failures.push('unexpected redirect');
     if(!/Partida no disponible|Decreto no disponible/.test(final.text))failures.push('missing no-data message');
     if(/Imprimir partida|Imprimir decreto/.test(final.text))failures.push('unexpected print control');
    }else if(final.path!==dashboard)failures.push('role did not redirect to its dashboard');
    if(/Unexpected Application Error|Something went wrong|Cannot read properties/.test(final.text))failures.push('render error text');
    if(exceptions.length>before)failures.push('JavaScript exception');
   }catch(error){failures.push(error.message.replace(/: \{.*$/s,''))}
   rows.push({role:account.role,path:target.path,page:target.page,passed:!failures.length,failures,durationMs:Date.now()-start,textLength:final?.text?.length});console.log((failures.length?'FAIL ':'PASS ')+target.path+' '+JSON.stringify(failures));
  }
 }
 fs.writeFileSync('AUDITORIA_RUTAS_INVENTARIO_V209.json',JSON.stringify({protocol:'V209',date:new Date().toISOString(),dynamicRoutes:routes.filter(x=>x.dynamic)},null,2)+'\n');
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const report={protocol:'V209',scope:'Actual full application, genuine GoTrue login, 2 protected dynamic routes, 4 authenticated roles, malformed and nonexistent IDs. Read-only negative UI tests only. No existing foreign record, positive detail, email link, CRUD or full button coverage claimed.',date:new Date().toISOString(),rows,exceptions,externalRequests};
fs.writeFileSync('AUDITORIA_RUTAS_DINAMICAS_V209.json',JSON.stringify(report,null,2)+'\n');
console.log('V209_DYNAMIC_ROUTES '+rows.filter(x=>x.passed).length+'/'+rows.length);if(rows.some(r=>!r.passed)||exceptions.length)process.exitCode=1;
