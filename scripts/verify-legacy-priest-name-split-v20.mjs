import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const profile=read('src/config/legacyImportProfiles.js');
const sql=read('supabase/applied-history/SACRAMENTUM_LEGACY_PRIEST_NAME_SPLIT_V20.sql');
const list=read('src/pages/parish/auxiliary/ParrocosList.jsx');

const checks=[];
const check=(name,ok)=>{const pass=Boolean(ok);checks.push({name,pass});console.log(pass?'✓':'✗',name);};

check('Perfil PARROCOS separa nombres',profile.includes('splitLegacyPriestName'));
check('Perfil conserva priest_name completo',profile.includes('priest_name: fullName'));
check('Perfil genera priest_given_names',profile.includes('priest_given_names'));
check('Perfil genera priest_surnames',profile.includes('priest_surnames'));
check('Perfil conserva honorífico',profile.includes('priest_honorific'));
check('Perfil marca confianza',profile.includes('name_split_confidence'));

check('SQL parser central existe',sql.includes('sacramentum_split_legacy_priest_name'));
check('SQL trigger central existe',sql.includes('trg_normalize_legacy_priest_name'));
check('SQL conserva legacy_full_name',sql.includes("'legacy_full_name'"));
check('SQL conserva honorífico y apellidos',sql.includes("'legacy_honorific'") && sql.includes("'legacy_surnames'"));
check('SQL evita separación agresiva con partículas',sql.includes("'DE','DEL','LA','LAS','LOS','Y','SAN','SANTA'"));
check('SQL backfill registros existentes',sql.includes("where payload->>'source'='legacy_migration'"));

check('Lista lee apellido real',list.includes('apellido: dbItem.apellido'));
check('Lista compone identidad nombre + apellido',list.includes('{item.nombre} {item.apellido}'));

const failed=checks.filter(x=>!x.pass);
if(failed.length){
  console.error(`\nSACRAMENTUM V20 · FALLÓ · ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V20 · OK · ${checks.length}/${checks.length} controles.`);
