// Two independently authenticated GoTrue users; no fabricated JWT claims.
// QA probe always raises P0208 to roll back sacramental writes before each HTTP request ends.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';
const config=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
const a=config.users.find(u=>u.kind==='parish_a1'),b=config.users.find(u=>u.kind==='parish_a2');
async function session(account){const c=createClient(config.url,config.apiKey,{auth:{autoRefreshToken:false,persistSession:false}});const result=await c.auth.setSession({access_token:account.session.access_token,refresh_token:account.session.refresh_token});if(result.error)throw Error('QA Auth session unavailable');return c}
const ca=await session(a),cb=await session(b),rows=[];
const probe=async(client,kind,id,delay=0)=>await client.rpc('qa_v208_concurrency_probe',{p_parish_id:a.parishId,p_mode:kind,p_request_id:id,p_delay_ms:delay});
const detail=r=>{if(r.error?.code!=='P0208')throw Error('Unexpected probe result '+r.error?.code+' '+r.error?.message);return JSON.parse(r.error.details)};
for(const kind of ['bautismo','confirmacion','matrimonio','exequias','linked']){
 const before=await ca.from('parish_parameters').select('*').eq('parish_id',a.parishId).single();if(before.error)throw before.error;
 const id=randomUUID(),delay=kind==='bautismo'?6000:1400;
 const pa=probe(ca,kind,id,delay);await new Promise(r=>setTimeout(r,180));const pb=probe(cb,kind,id,0);
 const [ra,rb]=await Promise.all([pa,pb]);const da=detail(ra),db=detail(rb);
 const after=await ca.from('parish_parameters').select('*').eq('parish_id',a.parishId).single();
 const faults=[];
 if(da.pid===db.pid)faults.push('same backend PID');
 if(!(Date.parse(db.started)<Date.parse(da.ended)&&Date.parse(db.started)>Date.parse(da.started)))faults.push('no overlapping backend interval');
 if(db.wait_ms<delay-500)faults.push('second backend did not wait for first');
 if(JSON.stringify(before.data)!==JSON.stringify(after.data))faults.push('counter or parameter residue after rollback');
 rows.push({kind,passed:!faults.length,faults,first:{pid:da.pid,started:da.started,acquired:da.acquired,ended:da.ended,waitMs:da.wait_ms},second:{pid:db.pid,started:db.started,acquired:db.acquired,ended:db.ended,waitMs:db.wait_ms},parametersUnchanged:JSON.stringify(before.data)===JSON.stringify(after.data)});
 console.log((faults.length?'FAIL ':'PASS ')+kind+' second_wait_ms='+db.wait_ms+' backends='+da.pid+','+db.pid);
}
const id=randomUUID();
const x=probe(ca,'deadlock_a',id,0);await new Promise(r=>setTimeout(r,120));const y=probe(cb,'deadlock_b',id,0);
const deadlock=await Promise.all([x,y]);const codes=deadlock.map(r=>r.error?.code).sort();
const recovery=await probe(ca,'bautismo',randomUUID(),0);
const deadlockResult={codes,oneDeadlockVictim:codes.includes('40P01'),survivorRolledBack:codes.includes('P0208'),nextRequestRecovered:recovery.error?.code==='P0208'};
const report={protocol:'V208',scope:'Two genuine GoTrue users and overlapping physical PostgreSQL backends. Controlled QA advisory deadlock, not a claimed production incident.',date:new Date().toISOString(),actorIds:[a.id,b.id],rows,deadlock:deadlockResult};
fs.writeFileSync('AUDITORIA_CONCURRENCIA_REAL_V208.json',JSON.stringify(report,null,2)+'\n');
console.log('V208_CONCURRENCY '+rows.filter(r=>r.passed).length+'/5 deadlock='+JSON.stringify(deadlockResult));
if(rows.some(r=>!r.passed)||!deadlockResult.oneDeadlockVictim||!deadlockResult.survivorRolledBack||!deadlockResult.nextRequestRecovered)process.exitCode=1;
