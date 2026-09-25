import { DatabaseSync } from 'node:sqlite';
const p='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(p,{readOnly:true});
const row=db.prepare('select key,utf16_length,conversion_type,compression_type,value from data where key=?').get('sb-foczofcmwampjvlfbsqn-auth-token');
if(!row){console.log('NOT_FOUND');process.exit(1)}
console.log(JSON.stringify({utf16_length:row.utf16_length,conversion_type:row.conversion_type,compression_type:row.compression_type,value_type:typeof row.value,is_buffer:Buffer.isBuffer(row.value),ctor:row.value?.constructor?.name,byte_length:row.value?.byteLength??row.value?.length??null}));
db.close();
