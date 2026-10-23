// V169: Exercise the real event handlers; no Supabase connection or persistent data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync('src/pages/chancery/LaterNoteReconciliationPage.jsx','utf8');
const names=['doRequest','doApprove','doReject','doExecute','doExecuteGroup'];
const args={
  doRequest:{preventDefault(){}},
  doApprove:{id:'case-1',status:'pending'},
  doReject:{id:'case-1',status:'authorized'},
  doExecute:{id:'case-1',status:'authorized'},
  doExecuteGroup:[{id:'case-1',decree_id:'d-1'},{id:'case-2',decree_id:'d-1'}]
};
function extract(name){
  const begin=page.indexOf('  const '+name+'=async(');
  assert.ok(begin>=0,'missing handler '+name);
  const next=page.indexOf('\n  const do',begin+1);
  const end=next>=0?next:page.indexOf('\n  return <DashboardLayout>',begin);
  assert.ok(end>begin,'missing handler end '+name);
  return page.slice(begin,end);
}
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function createContext(){
  const log=[],inFlight=deferred(),confirmation=deferred();
  const env={
    identityKey:'diocese-old:chancery',
    currentIdentityRef:{current:'diocese-old:chancery'},
    scopeCurrent:true,dataCurrent:true,dioceseId:'diocese-1',
    dioceseRole:true,chancery:true,busy:'',
    completeAuthorizedList:true,
    form:{decreeId:'d-1',noteId:'n-1',reason:'Documented reason',sourceReference:'SOURCE-123'},
    empty:{decreeId:'',noteId:'',reason:'',sourceReference:''},
    approve:{'case-1':{reference:'AUTH-1234',reason:'Documented independent authorization'}},
    reject:{'case-1':{reference:'REVOKE-1234',reason:'Documented institutional revocation'}},
    setBusy:x=>log.push(['busy',x]),setError:x=>log.push(['error-state',x]),
    setForm:x=>log.push(['form',x]),setAvailableNotes:x=>log.push(['notes',x]),
    toast:x=>log.push(['toast',x]),reload:async()=>log.push(['reload']),
    notifyError:x=>log.push(['error',x]),
    institutionalConfirm:()=>confirmation.promise,
    requestLaterNoteReconciliation:()=>{log.push(['rpc']);return inFlight.promise;},
    approveLaterNoteReconciliation:()=>{log.push(['rpc']);return inFlight.promise;},
    rejectLaterNoteReconciliation:()=>{log.push(['rpc']);return inFlight.promise;},
    executeLaterNoteReconciliation:()=>{log.push(['rpc']);return inFlight.promise;},
    executeLaterNoteReconciliationBatch:()=>{log.push(['rpc']);return inFlight.promise;}
  };
  env.isCurrentIdentity=key=>key===env.currentIdentityRef.current;
  return {log,env,inFlight,confirmation};
}
function handler(name,env){
  const keys=Object.keys(env);
  return new Function(...keys,extract(name)+'\nreturn '+name+';')(...keys.map(x=>env[x]));
}
const effects=(log)=>log.filter(([name])=>['toast','reload','error','form','notes'].includes(name));
for(const name of names){
  test('V169 '+name+' ignores stale RPC success after identity switch',async()=>{
    const c=createContext();
    const run=handler(name,c.env);
    if(name!=='doRequest')c.confirmation.resolve(true);
    const operation=run(args[name]);
    // The institutional operation can finish after a different account signs in.
    await Promise.resolve();await Promise.resolve();
    c.env.currentIdentityRef.current='diocese-new:chancery';
    c.inFlight.resolve({status:'ok'});
    await operation;
    assert.deepEqual(effects(c.log),[]);
    assert.equal(c.log.some(([key,value])=>key==='busy'&&value===''),false);
  });
  test('V169 '+name+' ignores stale RPC failure after identity switch',async()=>{
    const c=createContext();
    const run=handler(name,c.env);
    if(name!=='doRequest')c.confirmation.resolve(true);
    const operation=run(args[name]);
    await Promise.resolve();await Promise.resolve();
    c.env.currentIdentityRef.current='diocese-new:chancery';
    c.inFlight.reject(new Error('Old institutional operation failed'));
    await operation;
    assert.deepEqual(effects(c.log),[]);
  });
  if(name!=='doRequest'){
    test('V169 '+name+' cannot send RPC after identity changes in confirmation',async()=>{
      const c=createContext();
      const operation=handler(name,c.env)(args[name]);
      c.env.currentIdentityRef.current='diocese-new:chancery';
      c.confirmation.resolve(true);
      await operation;
      assert.equal(c.log.filter(([key])=>key==='rpc').length,0);
      assert.deepEqual(effects(c.log),[]);
    });
  }
  test('V169 '+name+' still completes under unchanged identity',async()=>{
    const c=createContext();
    if(name!=='doRequest')c.confirmation.resolve(true);
    const operation=handler(name,c.env)(args[name]);
    c.inFlight.resolve({status:'ok'});
    await operation;
    assert.equal(c.log.filter(([key])=>key==='rpc').length,1);
    assert.equal(c.log.filter(([key])=>key==='toast').length,1);
    assert.equal(c.log.filter(([key])=>key==='reload').length,1);
  });
}
test('V169 all five actual callbacks capture the identity before awaiting a response',()=>{
  for(const name of names){
    const fn=extract(name);
    assert.match(fn,/const scopeAtStart=identityKey;/);
    if(name==='doExecuteGroup'){
      assert.match(fn,/if\(!confirmed \|\| !isCurrentIdentity\(scopeAtStart\)\)return;/);
      assert.match(fn,/if\(scopeAtStart===currentIdentityRef\.current\)notifyError\(err\)/);
    }else{
      assert.match(fn,/if\(!isCurrentIdentity\(scopeAtStart\)\)return;/);
      assert.match(fn,/if\(isCurrentIdentity\(scopeAtStart\)\)notifyError\(err\)/);
    }
  }
});
