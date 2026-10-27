import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getParishSessionScope } from '../src/utils/parishSessionScope.mjs';

const user={id:'auth-A',role:'parish',parishId:'parish-A',parish_id:'parish-A',dioceseId:'diocese-A',diocese_id:'diocese-A'};
const profile={id:'profile-A',auth_user_id:'auth-A',role:'parish',parish_id:'parish-A',diocese_id:'diocese-A',status:'ACTIVE',is_active:true};
const scope=(u=user,p=profile)=>getParishSessionScope(u,p);
test('V222 scoped active authenticated parish is accepted with canonical identifiers',()=>{
 const s=scope();
 assert.equal(s.authorized,true);
 assert.equal(s.parishId,'parish-A');
 assert.equal(s.dioceseId,'diocese-A');
 assert.ok(s.key.includes('profile-A'));
});
for(const [name,u,p] of [
 ['missing authenticated user',null,profile],
 ['missing real profile',user,null],
 ['profile belonging to another auth ID',user,{...profile,auth_user_id:'auth-B'}],
 ['inactive profile',user,{...profile,is_active:false}],
 ['null active flag',user,{...profile,is_active:null}],
 ['suspended profile',user,{...profile,status:'SUSPENDED'}],
 ['unknown status',user,{...profile,status:null}],
 ['diocese actor',user,{...profile,role:'diocese'}],
 ['chancery actor',user,{...profile,role:'chancery'}],
 ['unscoped parish profile',user,{...profile,parish_id:null}],
 ['unscoped diocese profile',user,{...profile,diocese_id:''}],
 ['misaligned parish projection',{...user,parishId:'parish-X',parish_id:'parish-X'},profile],
 ['misaligned diocese projection',{...user,dioceseId:'diocese-X',diocese_id:'diocese-X'},profile],
 ['misaligned user role',{...user,role:'admin_general'},profile]
]){
 test('V222 deny '+name,()=>{
  const s=scope(u,p);
  assert.equal(s.authorized,false);
  assert.equal(s.parishId,null);
  assert.equal(s.dioceseId,null);
  assert.equal(s.key,'unauthorized');
 });
}
test('V222 session key differentiates parish, diocese and profile independently',()=>{
 const a=scope();
 const b=scope({...user,parishId:'parish-B',parish_id:'parish-B'},{...profile,parish_id:'parish-B'});
 const c=scope({...user,dioceseId:'diocese-B',diocese_id:'diocese-B'},{...profile,diocese_id:'diocese-B'});
 const d=scope(user,{...profile,id:'profile-B'});
 assert.equal(new Set([a.key,b.key,c.key,d.key]).size,4);
});
test('V222 source does not inspect local storage, cookies, URL, or global browser scope',()=>{
 const source=fs.readFileSync('src/utils/parishSessionScope.mjs','utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|document|window|location|cookie|import\.meta\.env/);
});
const sacr=fs.readFileSync('src/pages/parish/SacramentalNotificationsPage.jsx','utf8');
const official=fs.readFileSync('src/pages/parish/ParishNotificationsPage.jsx','utf8');
const confirmation=fs.readFileSync('src/pages/parish/ConfirmationNotificationPage.jsx','utf8');
for(const [name,source,component] of [
 ['sacramental reception',sacr,'SacramentalNotificationsSession'],
 ['decree reception',official,'ParishNotificationsSession'],
 ['confirmation dispatch',confirmation,'ConfirmationNotificationSession']
]){
 test('V222 session remount and active parish policy for '+name,()=>{
  assert.match(source,/getParishSessionScope\(user, profile\)/);
  assert.match(source,/!scope\.authorized/);
  assert.match(source,new RegExp('<'+component+'\\s+key=\\{scope\\.key\\}'));
  assert.match(source,/sesión parroquial activa y verificada/);
 });
}
test('V222 sacramental loading version ignores outdated responses in success and error',()=>{
 assert.match(sacr,/loadEpoch = useRef\(0\)/);
 assert.match(sacr,/const epoch = \+\+loadEpoch\.current/);
 assert.ok((sacr.match(/epoch !== loadEpoch\.current/g)||[]).length>=5);
 assert.match(sacr,/if \(epoch === loadEpoch\.current\) setLoading\(false\)/);
});
test('V222 no receive/receipt mutator before current loaded case membership check',()=>{
 for(const method of ['openIncoming','openReceipt','requestAccept','requestManualResolution','requestPhysicalAcceptance','resolveManualPartida','acceptNotification','acceptPhysicalNotification'])
  assert.ok(sacr.includes(method),method);
 assert.match(sacr,/!incoming\.some\(row => row\.id === item\?\.id\)/);
 assert.match(sacr,/!receipts\.some\(row => row\.id === receipt\?\.id\)/);
 assert.match(sacr,/!incoming\.some\(row => row\.id === pendingAcceptance\.id\)/);
});
test('V222 confirmation context prevents late responses and validates origin/destination',()=>{
 assert.match(confirmation,/let current=true/);
 assert.match(confirmation,/return \(\)=>\{current=false;\}/);
 assert.match(confirmation,/ctx\.confirmations\.some\(c=>c\.id===confirmationId\)/);
 assert.match(confirmation,/ctx\.parishes\.some\(p=>p\.id===receiverParishId/);
});
test('V222 decree inbox has scoped query and active cleanup',()=>{
 assert.match(official,/listOfficialNotifications\(parishId\)/);
 assert.match(official,/if \(!active\) return/);
 assert.match(official,/return \(\) => \{ active = false; \}/);
});
test('V222 isolated real-browser regression is mandatory in GitHub Actions',()=>{
 const ci=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 assert.match(ci,/node scripts\/audit-parish-notification-session-browser-v222\.mjs/);
});
