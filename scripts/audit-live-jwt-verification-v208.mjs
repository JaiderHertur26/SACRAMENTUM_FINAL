import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8')),a=c.users.find(x=>x.kind==='parish_a2');
const sdk=createClient(c.url,c.apiKey,{auth:{persistSession:false,autoRefreshToken:false}});await sdk.auth.setSession(a.session);
const genuine=await sdk.auth.getUser(),token=a.session.access_token,pieces=token.split('.'),claims=JSON.parse(Buffer.from(pieces[1],'base64url'));
const altered={...claims,sub:crypto.randomUUID(),role:'service_role'},forged=pieces[0]+'.'+Buffer.from(JSON.stringify(altered)).toString('base64url')+'.'+pieces[2];
const identity=await sdk.auth.getUser(forged);
const rest=await fetch(c.url+'/rest/v1/user_profiles?select=id&limit=1',{headers:{apikey:c.apiKey,Authorization:'Bearer '+forged}});const restBody=await rest.json();
const metadata=await sdk.auth.updateUser({data:{role:'admin_general',is_admin:true}});
const refresh=await sdk.auth.refreshSession();if(refresh.error)throw Error('QA refresh failed');
const profile=await sdk.from('user_profiles').select('role').eq('auth_user_id',a.id).single();
const denied=await sdk.rpc('create_pending_registration_v207',{p_kind:'bautismo',p_parish_id:c.users.find(x=>x.kind==='parish_b').parishId,p_request_id:crypto.randomUUID(),p_record:{},p_confirmation_record:null});
const rows=[
 {kind:'genuine-issued-JWT',passed:!genuine.error&&genuine.data.user.id===a.id},
 {kind:'forged-identity-and-service-role-Auth',passed:!!identity.error,status:identity.error?.status},
 {kind:'forged-identity-and-service-role-PostgREST',passed:rest.status===401,status:rest.status,code:restBody.code},
 {kind:'self-editable-metadata-does-not-elevate-role',passed:!metadata.error&&profile.data?.role==='parish'&&!!denied.error,profileRole:profile.data?.role,protectedRpcCode:denied.error?.code}
];
a.session=refresh.data.session;fs.writeFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),JSON.stringify(c));
fs.writeFileSync('AUDITORIA_JWT_SERVIDOR_V208.json',JSON.stringify({protocol:'V208',date:new Date().toISOString(),scope:'Real GoTrue-issued QA JWT, forged token denied by Auth and PostgREST, real self-editable metadata ignored as authorization',rows},null,2)+'\n');
console.log(rows);if(rows.some(r=>!r.passed))process.exitCode=1;
