import fs from 'node:fs';
const bases=[
 String.raw`C:\Users\ASUS\AppData\Roaming\Mozilla\Firefox\Profiles\v15xmt1n.default-release\storage\default\http+++127.0.0.1+5173\ls\data.sqlite`,
 String.raw`C:\Users\ASUS\AppData\Roaming\Mozilla\Firefox\Profiles\v15xmt1n.default-release\storage\default\http+++localhost+5173\ls\data.sqlite`
];
const candidates=[];
for(const base of bases){
 for(const f of [base,base+'-wal',base+'-shm']){
  if(!fs.existsSync(f)) continue;
  const s=fs.readFileSync(f).toString('latin1');
  const re=/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
  for(const m of s.matchAll(re)){
   try{ const p=JSON.parse(Buffer.from(m[0].split('.')[1],'base64url').toString('utf8'));
    if(String(p.iss||'').includes('foczofcmwampjvlfbsqn')) candidates.push({file:f,token:m[0],exp:p.exp,sub:p.sub,role:p.role,email:p.email});
   }catch{}
  }
 }
}
candidates.sort((a,b)=>(b.exp||0)-(a.exp||0));
console.log(JSON.stringify(candidates.map((c,i)=>({i,file:c.file,exp:c.exp,validUntil:new Date((c.exp||0)*1000).toISOString(),sub:c.sub,role:c.role,email:c.email,tokenLength:c.token.length})),null,2));
if(candidates[0]) fs.writeFileSync('C:/SACRAMENTUM/SACRAMENTUM_FINAL/scripts/.tmp-sacramentum-jwt',candidates[0].token,{encoding:'ascii'});
