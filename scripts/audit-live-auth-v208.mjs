// Real GoTrue sessions from temporary QA-only accounts. Secrets stay outside the repository.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createClient} from '@supabase/supabase-js';
const privateFile=process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json');
const config=JSON.parse(fs.readFileSync(privateFile,'utf8'));const rows=[];
for(const account of config.users){
 const client=createClient(config.url,config.apiKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.signInWithPassword({email:account.email,password:account.password});
 if(error){rows.push({kind:account.kind,login:false,error:error.message,status:error.status});continue}
 account.session=data.session;
 const check=await client.auth.getUser(data.session.access_token);
 const profile=await client.from('user_profiles').select('auth_user_id,role,parish_id,diocese_id,is_active,status').eq('auth_user_id',account.id).single();
 rows.push({kind:account.kind,login:true,genuineAuthUser:check.data?.user?.id===account.id,profileMatches:profile.data?.auth_user_id===account.id,role:profile.data?.role,expectedRole:account.role,profileError:profile.error?.message||null});
 console.log('AUTH '+account.kind+' '+(rows.at(-1).genuineAuthUser&&rows.at(-1).profileMatches?'PASS':'FAIL'));
}
fs.writeFileSync(privateFile,JSON.stringify(config));
const wrong=createClient(config.url,config.apiKey,{auth:{autoRefreshToken:false,persistSession:false}});
const bad=await wrong.auth.signInWithPassword({email:config.users[0].email,password:'QA208-WRONG-PASSWORD'});
const report={protocol:'V208',scope:'Real GoTrue password grant and Auth getUser, no fabricated JWT claims',runId:config.runId,date:new Date().toISOString(),rows,passed:rows.filter(r=>r.login&&r.genuineAuthUser&&r.profileMatches&&r.role===r.expectedRole).length,total:8,wrongPasswordRejected:!!bad.error&&!bad.data?.session,wrongPasswordStatus:bad.error?.status||null};
fs.writeFileSync('AUDITORIA_AUTH_SESIONES_REALES_V208.json',JSON.stringify(report,null,2)+'\n');
console.log('V208_AUTH '+report.passed+'/8 wrong_password_rejected='+report.wrongPasswordRejected);
if(report.passed!==8||!report.wrongPasswordRejected)process.exitCode=1;
