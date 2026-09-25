import fs from 'node:fs';
const root=String.raw`C:\SACRAMENTUM\SACRAMENTUM_FINAL`;
const env=fs.readFileSync(root+'\\.env.local','utf8');
const val=(k)=>env.match(new RegExp('^'+k+'=(.*)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'')||'';
const url=val('VITE_SUPABASE_URL'); const apikey=val('VITE_SUPABASE_PUBLISHABLE_KEY')||val('VITE_SUPABASE_ANON_KEY');
const stores=[
 String.raw`C:\Users\ASUS\AppData\Roaming\Mozilla\Firefox\Profiles\v15xmt1n.default-release\storage\default\http+++127.0.0.1+5173\ls\data.sqlite`,
 String.raw`C:\Users\ASUS\AppData\Roaming\Mozilla\Firefox\Profiles\v15xmt1n.default-release\storage\default\http+++localhost+5173\ls\data.sqlite`
];
let token='';
for(const f of stores){
  if(!fs.existsSync(f)) continue;
  const b=fs.readFileSync(f); const marker=Buffer.from('"access_token":"'); const i=b.indexOf(marker);
  if(i<0) continue; const start=i+marker.length; const end=b.indexOf(0x22,start);
  if(end>start){ token=b.subarray(start,end).toString('ascii'); break; }
}
if(!url||!apikey||!token) throw new Error('No fue posible resolver URL/apikey/sesión Firefox');
const h={apikey,Authorization:`Bearer ${token}`};
async function get(path){ const r=await fetch(url+path,{headers:h}); const t=await r.text(); if(!r.ok) throw new Error(`${r.status} ${path}: ${t.slice(0,500)}`); return JSON.parse(t||'[]'); }
const batches=await get('/rest/v1/legacy_import_batches?select=id,original_filename,profile_key,parish_id,diocese_id,status,total_rows,valid_count,review_count,error_count,imported_count,metadata,created_at,updated_at&order=created_at.desc&limit=12');
console.log(JSON.stringify({latestBatches:batches},null,2));
