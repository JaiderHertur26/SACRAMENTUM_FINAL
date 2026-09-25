import fs from 'node:fs';
const files=[
  String.raw`C:\Users\ASUS\AppData\Roaming\Mozilla\Firefox\Profiles\v15xmt1n.default-release\storage\default\http+++127.0.0.1+5173\ls\data.sqlite`,
  String.raw`C:\Users\ASUS\AppData\Roaming\Mozilla\Firefox\Profiles\v15xmt1n.default-release\storage\default\http+++localhost+5173\ls\data.sqlite`
];
const needle='sb-foczofcmwampjvlfbsqn-auth-token';
for(const f of files){
  if(!fs.existsSync(f)){ console.log(JSON.stringify({file:f,exists:false})); continue; }
  const b=fs.readFileSync(f); const i=b.indexOf(Buffer.from(needle));
  console.log(JSON.stringify({file:f,exists:true,size:b.length,hasSacramentumSession:i>=0,index:i}));
}
