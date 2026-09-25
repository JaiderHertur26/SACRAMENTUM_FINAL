import { DatabaseSync } from 'node:sqlite';
import { snappyUncompress } from './firefox-snappy.mjs';
const p='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(p,{readOnly:true});
for(const key of ['currentUser','sacraments_user_profile']){
 const r=db.prepare('select value,compression_type,conversion_type,utf16_length from data where key=?').get(key);
 const raw=r.compression_type===1?snappyUncompress(r.value):r.value;
 for(const enc of ['utf-8','utf-16le']){
   const s=new TextDecoder(enc).decode(raw);
   let ok=false; try{JSON.parse(s);ok=true}catch{}
   console.log(key,enc,'rawBytes',raw.length,'utf16len',r.utf16_length,'parse',ok,'prefix',JSON.stringify(s.slice(0,30)));
 }
}
db.close();
