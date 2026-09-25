import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { snappyUncompress } from './firefox-snappy.mjs';

const parishId='ada2c810-c6eb-4b75-8e3c-4941e3022687';
const key='pendingBaptisms_'+parishId;
const root='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default';
for(const origin of ['http+++localhost+5173','http+++127.0.0.1+5173','http+++localhost+5174','http+++localhost+5175']){
  const p=root+'\\'+origin+'\\ls\\data.sqlite';
  if(!fs.existsSync(p)){ console.log(origin+' COUNT=NO_DB'); continue; }
  const db=new DatabaseSync(p,{readOnly:true});
  const row=db.prepare('select value,compression_type from data where key=?').get(key);
  if(!row){ console.log(origin+' COUNT=0'); db.close(); continue; }
  const bytes=row.compression_type===1?snappyUncompress(row.value):row.value;
  const data=JSON.parse(new TextDecoder().decode(bytes));
  const rows=Array.isArray(data)?data:[];
  console.log(origin+' COUNT='+rows.length);
  for(const x of rows) console.log(origin+' '+JSON.stringify({
    id:x.id||null,numeroRegistro:x.numeroRegistro||x.numero_registro||null,
    apellidos:x.apellidos||null,nombres:x.nombres||null,
    fechaSacramento:x.fechaSacramento||x.celebration_date||null,
    reportado:x.reportado??null,status:x.status||null
  }));
  db.close();
}
