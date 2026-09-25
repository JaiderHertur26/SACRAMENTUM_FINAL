import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const root=path.join(process.env.APPDATA,'Mozilla','Firefox','Profiles');
for(const name of fs.readdirSync(root)){
  const p=path.join(root,name,'places.sqlite');
  if(!fs.existsSync(p)) continue;
  try{
    const db=new DatabaseSync(p,{readOnly:true});
    const rows=db.prepare("select url,last_visit_date from moz_places where url like '%5173%' order by last_visit_date desc limit 20").all();
    db.close();
    if(rows.length){ console.log('PROFILE='+name); for(const r of rows) console.log(r.url); }
  }catch{}
}
