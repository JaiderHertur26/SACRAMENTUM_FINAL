import { DatabaseSync } from 'node:sqlite';
import { snappyUncompress } from './firefox-snappy.mjs';

const parishId='ada2c810-c6eb-4b75-8e3c-4941e3022687';
const key='pendingBaptisms_'+parishId;
const dbPath='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(dbPath,{readOnly:true});
const row=db.prepare('select value,compression_type from data where key=?').get(key);
if(!row){ console.log('COUNT=0'); process.exit(0); }
const bytes=row.compression_type===1?snappyUncompress(row.value):row.value;
const data=JSON.parse(new TextDecoder().decode(bytes));
const rows=Array.isArray(data)?data:[];
console.log('COUNT='+rows.length);
for(const x of rows){
  console.log(JSON.stringify({
    id:x.id||null,numeroRegistro:x.numeroRegistro||x.numero_registro||null,
    apellidos:x.apellidos||null,nombres:x.nombres||null,
    fechaSacramento:x.fechaSacramento||x.celebration_date||null,
    reportado:x.reportado??null,status:x.status||null,source:x.source||null
  }));
}
db.close();
