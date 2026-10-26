import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
const accounts=Object.fromEntries(c.users.map(a=>[a.kind,a])),rows=[];
for(const [kind,target] of [['parish_a1','parish_b'],['parish_a1','parish_x'],['diocese_a','parish_x'],['diocese_b','parish_a1'],['chancery','parish_a1'],['admin_general','parish_a1']]){
 const a=accounts[kind],b=accounts[target],sdk=createClient(c.url,c.apiKey,{auth:{persistSession:false,autoRefreshToken:false}});await sdk.auth.setSession(a.session);
 for(const sacrament of ['bautismo','confirmacion','matrimonio','exequias']){
  const r=await sdk.rpc('create_pending_registration_v207',{p_kind:sacrament,p_parish_id:b.parishId,p_request_id:crypto.randomUUID(),p_record:{raw_data:{qa_v208:true}},p_confirmation_record:null});
  const passed=!!r.error&&/autoriza|perfil|parroquia|diócesis|diocesis|jurisdic/i.test(r.error.message);
  rows.push({actor:kind,target,sacrament,passed,code:r.error?.code,message:r.error?.message});console.log((passed?'PASS ':'FAIL ')+kind+' -> '+target+' '+sacrament+' '+(r.error?.code||'WRITE ACCEPTED'));
 }
}
const manager=createClient(c.url,c.apiKey,{auth:{persistSession:false,autoRefreshToken:false}});await manager.auth.setSession(accounts.diocese_b.session);
const denied=await manager.rpc('set_managed_user_active',{p_profile_id:accounts.parish_a1.profileId,p_active:false});
rows.push({actor:'diocese_b',target:'parish_a1',action:'cross-diocese access administration',passed:!!denied.error,code:denied.error?.code,message:denied.error?.message});
fs.writeFileSync('AUDITORIA_AUTH_JURISDICCIONES_V208.json',JSON.stringify({protocol:'V208',date:new Date().toISOString(),scope:'Genuine GoTrue credentials, real protected RPCs. All attempts must be denied without any sacramental write.',rows},null,2)+'\n');
if(rows.some(r=>!r.passed))process.exitCode=1;
