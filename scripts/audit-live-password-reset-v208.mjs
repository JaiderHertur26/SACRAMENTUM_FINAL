import {createClient} from '@supabase/supabase-js';import {randomBytes} from 'node:crypto';
// Actual complete application, actual login form, genuine GoTrue accounts, real RLS.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const chrome=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chrome unavailable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const config=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
const baseline=process.argv.includes('--baseline');
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
 const pending=new Map();let seq=0,passwordWrites=0;
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id,method,params}))});
 socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.id&&pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);m.error?cb.reject(Error(m.error.message)):cb.resolve(m.result||{})}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||'JS exception');
  if(m.method==='Fetch.requestPaused'){
   const url=m.params.request.url;if(url.includes('/auth/v1/user')&&m.params.request.method==='PUT')passwordWrites++;
   if(!url.startsWith('http://127.0.0.1:4859/')&&!url.startsWith(config.url+'/')){externalRequests.push(url);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}
   else call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});
  }
 });
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value};
 const state=()=>evaluate("({path:location.pathname,text:(document.querySelector('#root')?.textContent||'').slice(0,3500),emailInput:!!document.querySelector('input[type=email]'),newPasswordInput:!!document.querySelector('#new-password')})");
 const waitFor=async(predicate,label)=>{let s;for(let i=0;i<300;i++){s=await state();if(predicate(s))return s;await sleep(60)}throw Error('Timeout '+label+': '+JSON.stringify(s).slice(0,900))};
 const click=async(label,twice=false)=>evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes("+JSON.stringify(label)+"));if(!b||b.disabled)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));b.click();"+(twice?"b.click();":"")+"return true})()");
 await call('Page.enable');await call('Runtime.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});




 const failures=[];let evidence;
 try{
  await call('Page.navigate',{url:'http://127.0.0.1:4859/reset-password'});await waitFor(s=>s.text.includes('Solicita otro'),'anonymous reset rejection');
  const anonymous=await state();if(anonymous.newPasswordInput)throw Error('Anonymous user obtained password form');
  const account=config.users.find(a=>a.kind==='parish_b'),oldPassword=account.password,newPassword='QA208!'+randomBytes(30).toString('base64url');
  await call('Page.navigate',{url:'http://127.0.0.1:4859/'});await waitFor(s=>s.emailInput,'login');
  const fill=(selector,value)=>evaluate("(()=>{const el=document.querySelector("+JSON.stringify(selector)+");const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,"+JSON.stringify(value)+");el.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
  await fill('input[type=email]',account.email);await fill('input[type=password]',oldPassword);
  await evaluate("document.querySelector('input[type=password]').closest('form').requestSubmit()");
  await waitFor(s=>s.path==='/parish/dashboard'&&s.text.length>100,'real login');
  await call('Page.navigate',{url:'http://127.0.0.1:4859/reset-password'});await waitFor(s=>s.newPasswordInput,'real validated password form');
  await fill('#new-password',newPassword);await fill('#confirm-password',newPassword);
  await evaluate("(()=>{const f=document.querySelector('#new-password').closest('form');f.requestSubmit();f.requestSubmit()})()");
  await waitFor(s=>s.text.includes('Contraseña actualizada'),'password saved');
  await sleep(500);const final=await state();
  if(passwordWrites!==1)throw Error('Double submit issued '+passwordWrites+' password writes');
  const persisted=await evaluate("Object.keys(localStorage).filter(k=>k.endsWith('-auth-token')||k==='currentUser'||k==='sacraments_user_profile')");
  if(persisted.length)throw Error('Password reset retained browser credentials');
  const verifier=createClient(config.url,config.apiKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const oldResult=await verifier.auth.signInWithPassword({email:account.email,password:oldPassword});
  if(!oldResult.error||oldResult.data.session)throw Error('Previous password still accepted');
  const newResult=await verifier.auth.signInWithPassword({email:account.email,password:newPassword});
  if(newResult.error||newResult.data.user?.id!==account.id)throw Error('New password did not authenticate same QA user');
  account.password=newPassword;account.session=newResult.data.session;
  fs.writeFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),JSON.stringify(config));
  evidence={anonymousFormDenied:!anonymous.newPasswordInput,realIdentityValidated:true,passwordWrites,oldPasswordRejected:true,newPasswordAccepted:true,sameUser:true,persistedKeys:persisted,successVisible:final.text.includes('Contraseña actualizada')};
 }catch(error){failures.push(error.message)}
 rows.push({kind:'real-own-password-reset',passed:!failures.length,failures,evidence});console.log((failures.length?'FAIL ':'PASS ')+'real-own-password-reset '+JSON.stringify(failures));
}finally{try{socket?.close()}catch{}try{browser?.kill()}catch{}try{vite.kill()}catch{}try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
const sources=['src/App.jsx','src/pages/ResetPasswordPage.jsx','src/components/PasswordRecoveryRedirect.jsx','src/services/passwordRecoveryService.js'];
const report={protocol:'V208',scope:'Actual complete application and genuine GoTrue password update for a QA account. No email delivery or recovery-link exchange is claimed.',date:new Date().toISOString(),sourceSha256:Object.fromEntries(sources.map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')])),rows,exceptions,externalRequests};
fs.writeFileSync('AUDITORIA_RECUPERACION_PASSWORD_V208.json',JSON.stringify(report,null,2)+'\n');
if(rows.some(r=>!r.passed)||exceptions.length)process.exitCode=1;