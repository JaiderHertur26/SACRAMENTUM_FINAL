import { DatabaseSync } from 'node:sqlite';
import { snappyUncompress } from './firefox-snappy.mjs';
const p='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(p,{readOnly:true});
for(const key of ['currentUser','sacraments_user_profile']){
 const r=db.prepare('select value,compression_type from data where key=?').get(key); if(!r)continue;
 const bytes=r.compression_type===1?snappyUncompress(r.value):r.value;
 const x=JSON.parse(new TextDecoder().decode(bytes));
 console.log(key,JSON.stringify({role:x.role,parish_id:x.parish_id||x.parishId||null,diocese_id:x.diocese_id||x.dioceseId||null,parishName:x.parishName||x.parish_name||null}));
}
db.close();
