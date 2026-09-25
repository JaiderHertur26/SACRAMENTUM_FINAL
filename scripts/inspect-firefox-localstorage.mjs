import { DatabaseSync } from 'node:sqlite';
const p='C:\\Users\\ASUS\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\v15xmt1n.default-release\\storage\\default\\http+++localhost+5173\\ls\\data.sqlite';
const db=new DatabaseSync(p,{readOnly:true});
const tables=db.prepare("select name from sqlite_master where type='table'").all();
console.log('TABLES='+tables.map(x=>x.name).join(','));
for(const t of tables){
  try{
    const cols=db.prepare(`pragma table_info(${t.name})`).all();
    console.log('TABLE='+t.name+' COLS='+cols.map(c=>c.name).join(','));
    if(cols.some(c=>c.name==='key')){
      const rows=db.prepare(`select key,length(value) as len from ${t.name}`).all();
      for(const r of rows) console.log('KEY='+r.key+' LEN='+r.len);
    }
  }catch{}
}
db.close();
