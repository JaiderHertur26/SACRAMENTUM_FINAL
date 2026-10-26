// Behavioral regressions execute the actual AuthProvider with its final provider element captured by a hook host.
// Minimal hook host supplies state/effect lifecycle; the Supabase transport is controlled.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {parse} from '@babel/parser';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const authz=read('src/lib/authz.js').replace(/^import .*;\n/gm,'');
const roles="const ROLE_TYPES={ADMIN_GENERAL:'admin_general',DIOCESE:'diocese',CHANCERY:'chancery',PARISH:'parish'};\n";
const auth=read('src/context/AuthContext.jsx').replace(/^import .*;\n/gm,'');
const ast=parse(auth,{sourceType:'module',plugins:['jsx']});
const provider=ast.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.[0]?.id.name==='AuthProvider').declaration.declarations[0].init;
const finalReturn=provider.body.body.findLast(n=>n.type==='ReturnStatement');
const captured=auth.slice(0,finalReturn.start)+'return {props:{value}};'+auth.slice(finalReturn.end);
const compiled=(roles+authz+captured).replace(/\bexport const /g,'const ')+'\nmodule.exports={AuthProvider};';
const tick=()=>new Promise(r=>setTimeout(r,10));
async function host({heldUser=null,inactive=false,logoutError=false}={}){
 let slots=[],cursor=0,first=true,value,listener,inCallback=false,release,held=false,profileCalls=0,redirected=false,callbackReturnedPromise=false;
 const gate=new Promise(r=>release=r),effects=[],storage=new Map([['sb-qa-auth-token','session']]);
 const fakeReact={createContext:()=>({Provider:'provider'}),useContext:()=>value,useState:init=>{const i=cursor++;if(first)slots[i]=init;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef:init=>{const i=cursor++;if(first)slots[i]={current:init};return slots[i]},useMemo:fn=>fn(),useEffect:fn=>{if(first)effects.push(fn)},createElement:(type,props,...children)=>({type,props,children})};
 const emit=(event,s)=>{inCallback=true;const result=listener?.(event,s);callbackReturnedPromise ||= !!result?.then;inCallback=false;return result};
 const session=id=>({user:{id,email:id+'@example.invalid'},access_token:'controlled-test-token'});
 const sdk={auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:cb=>{listener=cb;return {data:{subscription:{unsubscribe(){}}}}},signInWithPassword:async({email})=>{const s=session(email.split('@')[0]);emit('SIGNED_IN',s);return {data:{session:s},error:null}},signOut:async()=>{if(logoutError)return {error:Error('network offline')};emit('SIGNED_OUT',null);return {error:null}}},
 from:table=>({select(){return this},eq(_column,id){this.id=id;return this},async maybeSingle(){if(inCallback)throw Error('SDK call inside auth callback');if(table!=='user_profiles')return {data:{name:'QA',diocese_id:'qa-diocese'}};profileCalls++;if(this.id===heldUser){held=true;await gate}return {data:{id:this.id,auth_user_id:this.id,role:'parish',parish_id:'qa-parish',diocese_id:'qa-diocese',is_active:!inactive,status:inactive?'INACTIVE':'ACTIVE'},error:null}}})};
 const globals={module:{exports:{}},exports:{},console:{warn(){},error(){}},React:fakeReact,...fakeReact,supabase:sdk,AUTH_STORAGE_KEY:'sb-qa-auth-token',Loader2:()=>null,setTimeout,clearTimeout,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{location:{assign:()=>{redirected=true}}}};
 globals.exports=globals.module.exports;vm.runInNewContext(compiled,globals);
 const render=()=>{cursor=0;const element=globals.module.exports.AuthProvider({children:null});value=element.props.value;first=false;return value};
 render();for(const fn of effects)fn();await tick();render();
 const state=()=>render();const waitHeld=async()=>{for(let i=0;i<100&&!held;i++)await tick();assert.equal(held,true)};
 return {state,emit,release,waitHeld,storage,stats:()=>({profileCalls,redirected,callbackReturnedPromise})};
}
test('V208 a late profile response cannot resurrect a signed-out user',async()=>{
 const h=await host({heldUser:'a'});const attempt=h.state().login('A@example.invalid','test');await h.waitHeld();h.emit('SIGNED_OUT',null);h.release();await attempt;await tick();
 const s=h.state();assert.equal(s.isAuthenticated,false);assert.equal(s.user,null);assert.equal(s.session,null);assert.equal(h.storage.has('currentUser'),false);
});
test('V208 a late first login cannot replace the second authenticated user',async()=>{
 const h=await host({heldUser:'a'});const first=h.state().login('A@example.invalid','test');await h.waitHeld();const second=await h.state().login('B@example.invalid','test');await tick();h.release();await first;await tick();
 assert.equal(second.success,true);assert.equal(h.state().user.id,'b');assert.equal(h.state().isAuthenticated,true);
});
for(const logoutError of [false,true])test('V208 app logout clears credentials and roles '+(logoutError?'with failed network':'online'),async()=>{
 const h=await host({logoutError});await h.state().login('A@example.invalid','test');await tick();assert.equal(h.state().isAuthenticated,true);
 await h.state().logout();await tick();assert.equal(h.state().isAuthenticated,false);assert.equal(h.state().session,null);assert.equal(h.storage.has('sb-qa-auth-token'),false);assert.equal(h.storage.has('currentUser'),false);assert.equal(h.stats().redirected,true);
});
test('V208 auth event callback returns synchronously before loading the profile',async()=>{
 const h=await host();await h.state().login('A@example.invalid','test');await tick();assert.equal(h.stats().callbackReturnedPromise,false);assert.ok(h.stats().profileCalls>0);assert.equal(h.state().isAuthenticated,true);
});
test('V208 inactive institutional profile cannot obtain an authenticated projection',async()=>{
 const h=await host({inactive:true});const r=await h.state().login('A@example.invalid','test');await tick();assert.equal(r.success,false);assert.equal(h.state().isAuthenticated,false);assert.ok(h.state().configurationError);assert.equal(h.storage.has('currentUser'),false);
});