import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { snappyUncompress } from './firefox-snappy.mjs';
const ROOT='C:\\SACRAMENTUM\\SACRAMENTUM_FINAL';
const ref='foczofcmwampjvlfbsqn';
const profile='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release';
const origins=['http+++localhost+5173','http+++127.0.0.1+5173'];
let rawSession=null;
for(const origin of origins){
  const dbPath=path.join(profile,'storage','default',origin,'ls','data.sqlite');
  if(!fs.existsSync(dbPath)) continue;
  try{
    const db=new DatabaseSync(dbPath,{readOnly:true});
    const row=db.prepare('select value,compression_type,conversion_type from data where key=? limit 1').get(`sb-${ref}-auth-token`);
    db.close();
    if(row?.value){
      const bytes=row.value instanceof Uint8Array?row.value:new Uint8Array(row.value);
      const decoded=row.compression_type===1?snappyUncompress(bytes):bytes;
      rawSession=new TextDecoder('utf-8').decode(decoded);
      break;
    }
  }catch{}
}
if(!rawSession){ console.log('NO_BROWSER_SESSION'); process.exit(2); }
let session; try{ session=JSON.parse(rawSession); }catch{ console.log('BAD_BROWSER_SESSION_JSON'); process.exit(3); }
const access=session.access_token || session.currentSession?.access_token;
if(!access){ console.log('NO_ACCESS_TOKEN'); process.exit(4); }
console.log('BROWSER_SESSION_OK');
const env={};
for(const file of ['.env.local','.env']){
  const p=path.join(ROOT,file); if(!fs.existsSync(p)) continue;
  for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){
    if(!line.includes('=') || line.trim().startsWith('#')) continue;
    const i=line.indexOf('='); env[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
  }
}
const url=env.VITE_SUPABASE_URL;
const apikey=env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if(!url||!apikey){console.log('NO_SUPABASE_ENV');process.exit(5)}
const headers={apikey,Authorization:`Bearer ${access}`,Accept:'application/json'};
async function rest(table,params={}){
  const u=new URL(`${url}/rest/v1/${table}`); for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  const r=await fetch(u,{headers}); if(!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`); return await r.json();
}
async function exactCount(table,filters={}){
  const u=new URL(`${url}/rest/v1/${table}`); u.searchParams.set('select','id');
  for(const [k,v] of Object.entries(filters)) u.searchParams.set(k,v);
  const r=await fetch(u,{headers:{...headers,Prefer:'count=exact',Range:'0-0'}}); if(!r.ok) throw new Error(`${table} count ${r.status} ${await r.text()}`);
  const cr=r.headers.get('content-range')||'*/0'; const tail=cr.split('/').at(-1); return /^\d+$/.test(tail)?Number(tail):null;
}
const batches=await rest('legacy_import_batches',{select:'id,profile_key,original_filename,status,row_count,valid_count,review_count,imported_count,skipped_count,error_count,parish_id,sha256,created_at,updated_at,metadata',profile_key:'in.(BAUTIZOS,CONFIRMA,INSBAUTI,INSCONFI)',order:'created_at.desc',limit:'20'});
console.log('BATCHES_JSON='+JSON.stringify(batches));
const parishIds=[...new Set(batches.map(b=>b.parish_id).filter(Boolean))];
const parishes=parishIds.length?await rest('parishes',{select:'id,name,diocese_id,city',id:`in.(${parishIds.join(',')})`}):[];
console.log('PARISHES_JSON='+JSON.stringify(parishes));
const latest={}; for(const b of batches) latest[b.profile_key] ??= b;
for(const prof of ['INSBAUTI','INSCONFI']){
  const b=latest[prof]; if(!b){console.log(prof+'_NONE');continue;}
  const rows=await rest('legacy_import_rows',{select:'id,row_number,status,target_entity,target_table,target_id,issue_codes,issue_details,source_key',batch_id:`eq.${b.id}`,order:'row_number.asc',limit:'1000'});
  const pre=await rest('legacy_pre_sacrament_registrations',{select:'id,profile_key,batch_id,row_id,sacrament_type,legacy_entry_number,source_parish_name,reported,reconciliation_status,matched_table,matched_record_id,match_method,match_score,names,last_names,celebration_date,birth_date,normalized_data',batch_id:`eq.${b.id}`,order:'created_at.asc',limit:'1000'});
  const by=(arr,key)=>arr.reduce((a,x)=>{const v=String(x[key]??'null');a[v]=(a[v]||0)+1;return a;},{});
  console.log(prof+'_SUMMARY='+JSON.stringify({batch:b,rows:rows.length,row_status:by(rows,'status'),pre:pre.length,reported:by(pre,'reported'),reconciliation:by(pre,'reconciliation_status'),matched_table:by(pre,'matched_table')}));
  const table=prof==='INSBAUTI'?'pending_baptisms':'pending_confirmations';
  const pending=b.parish_id?await rest(table,{select:'id,parish_id,status,reportado,created_at,raw_data',parish_id:`eq.${b.parish_id}`,order:'created_at.desc',limit:'1000'}):[];
  const importedPending=pending.filter(p=>JSON.stringify(p.raw_data||{}).includes(b.sha256||'__NOHASH__') || JSON.stringify(p.raw_data||{}).includes(prof));
  console.log(prof+'_PENDING_SUMMARY='+JSON.stringify({total_in_owner_parish:pending.length,by_reportado:by(pending,'reportado'),by_status:by(pending,'status'),linked_to_batch_or_profile:importedPending.length}));
  console.log(prof+'_UNMATCHED_SAMPLE='+JSON.stringify(pre.filter(x=>x.reconciliation_status!=='matched').slice(0,5).map(x=>({entry:x.legacy_entry_number,reported:x.reported,status:x.reconciliation_status,name:`${x.names||''} ${x.last_names||''}`.trim(),date:x.celebration_date,source:x.source_parish_name}))));
}
for(const table of ['baptisms','confirmations','pending_baptisms','pending_confirmations']) console.log(table.toUpperCase()+'_COUNT='+await exactCount(table));
for(const pid of parishIds){
  const pp=await rest('parish_parameters',{select:'parish_id,bautizos_params,confirmaciones_params',parish_id:`eq.${pid}`,limit:'1'});
  console.log('PARAMS_'+pid+'='+JSON.stringify(pp[0]||null));
}
