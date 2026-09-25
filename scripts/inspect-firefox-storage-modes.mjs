import { DatabaseSync } from 'node:sqlite';
const p='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(p,{readOnly:true});
for(const key of ['currentUser','sacraments_user_profile','pendingBaptisms_ada2c810-c6eb-4b75-8e3c-4941e3022687','sb-foczofcmwampjvlfbsqn-auth-token']){
 const r=db.prepare('select key,utf16_length,conversion_type,compression_type,length(value) len from data where key=?').get(key);
 console.log(JSON.stringify(r));
}
db.close();
