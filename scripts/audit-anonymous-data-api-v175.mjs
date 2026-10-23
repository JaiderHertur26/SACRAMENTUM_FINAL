// V175: real remote Supabase Data API with the application's public/anon key.
// Sends no private user data and never logs keys, IDs or sacramental values.
import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(x=>/^[A-Z_][A-Z0-9_]*=/.test(x)).map(x=>{const p=x.indexOf('=');return [x.slice(0,p),x.slice(p+1).trim().replace(/^"|"$/g,'')]}));
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY;
if(!url?.startsWith('https://')||!key)throw Error('Supabase public access parameters unavailable');
const tables=['baptisms','confirmations','marriages','funerals','decretos','marginal_notes','user_profiles','chat_messages','chat_rooms','registry_audit_log','legacy_archive_records','bishop_tenures','later_note_reconciliations_v156','matrimonial_notifications','matrimonial_notification_recipients'];
const results=await Promise.all(tables.map(async table=>{
 try{
  const endpoint=url+'/rest/v1/'+table+'?select=id&limit=1';
  const resp=await fetch(endpoint,{method:'GET',headers:{apikey:key,Authorization:'Bearer '+key,'Accept':'application/json'},signal:AbortSignal.timeout(13000)});
  const body=await resp.json();
  const rows=Array.isArray(body)?body.length:null;
  const privateExposed=resp.ok && rows!==0;
  const code=typeof body?.code==='string' && /^[A-Z0-9_]{1,30}$/i.test(body.code)?body.code:null;
  const gatewayKeyError=/invalid api key|invalid apikey|invalid jwt|jwt expired|apikey missing/i.test(String(body?.message||''));
  return {table,status:resp.status,returnedRows:rows,privateExposed,responseKind:Array.isArray(body)?'array':'error-or-object',errorCode:code,gatewayKeyError};
 }catch(e){return {table,status:'ERROR',returnedRows:null,privateExposed:false,errorType:String(e.name||'NetworkError')}}
}));
const report={protocol:'V175',date:new Date().toISOString(),method:'Real HTTPS Supabase PostgREST with publishable client key and anonymous role, no authenticated session',checks:results.length,privateRowsSeen:results.filter(x=>x.privateExposed).length,unverified:results.filter(x=>x.status==='ERROR'||x.gatewayKeyError).length,results};
fs.writeFileSync('AUDITORIA_DATA_API_ANONIMA_V175.json',JSON.stringify(report,null,2)+'\n');
console.log('V175_ANON_REST '+report.checks+' checks, private rows '+report.privateRowsSeen+', transport failures '+report.unverified);
for(const row of results)console.log(row.table+': HTTP '+row.status+' rows '+String(row.returnedRows)+' code '+String(row.errorCode)+' keyRejected '+Boolean(row.gatewayKeyError));
if(report.privateRowsSeen||report.unverified)process.exitCode=1;