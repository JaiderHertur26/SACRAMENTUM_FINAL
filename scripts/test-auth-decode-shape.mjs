import { DatabaseSync } from 'node:sqlite';
import { snappyUncompress } from './firefox-snappy.mjs';
const p='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(p,{readOnly:true});
const r=db.prepare('select value,compression_type from data where key=?').get('sb-foczofcmwampjvlfbsqn-auth-token');
const raw=r.compression_type===1?snappyUncompress(r.value):r.value;
const s=new TextDecoder('utf-8').decode(raw);
let parsed=false, kind=''; try{const x=JSON.parse(s); parsed=true; kind=Array.isArray(x)?'array':typeof x;}catch(e){kind=e.message.slice(0,80)}
console.log(JSON.stringify({rawBytes:raw.length,stringLength:s.length,firstCode:s.charCodeAt(0),first2:s.slice(0,2).replace(/[A-Za-z0-9]/g,'x'),lastCode:s.charCodeAt(s.length-1),jsonParsed:parsed,kind}));
db.close();
