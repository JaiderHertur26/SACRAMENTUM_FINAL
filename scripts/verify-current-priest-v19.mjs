import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const sql=read('supabase/applied-history/SACRAMENTUM_CURRENT_PRIEST_LATEST_INGRESS_V19.sql');
const service=read('src/services/catalogsService.js');
const hook=read('src/hooks/useSacramentalAuxiliaries.js');
const list=read('src/pages/parish/auxiliary/ParrocosList.jsx');

const checks=[];
const check=(name,ok)=>{const pass=Boolean(ok);checks.push({name,pass});console.log(pass?'✓':'✗',name);};

check('SQL crea current_priest',sql.includes('sacramentum_current_priest'));
check('SQL recálculo usa fecha_ingreso más reciente',/order by p\.fecha_ingreso desc nulls last/.test(sql));
check('SQL no exige fecha_salida vigente para actual',!sql.includes('p.fecha_salida>=current_date'));
check('SQL último ingreso queda abierto en resolución por fecha',sql.includes('p.id=v_latest_id'));
check('SQL conserva histórico por periodo',sql.includes('p.fecha_salida>=v_target'));
check('SQL recalcula todas las parroquias',sql.includes('for r in select id from public.parishes'));

check('Servicio getParrocoActual usa última fecha ingreso',/getParrocoActual[\s\S]*_inicio[\s\S]*sort\(\(a, b\) => b\._inicio/.test(service));
check('Servicio histórico deja abierto al último ingreso',service.includes('(latest && p.id === latest.id)'));
check('Hook currentPriest independiente de fecha_salida',hook.includes('const currentPriest=useMemo'));
check('Hook histórico deja abierto al último ingreso',hook.includes('if(latest && row.id===latest.id) return true'));
check('Lista muestra estado real ACTIVO/HISTORICO',list.includes("String(item.estado).toUpperCase() === 'ACTIVO'"));
check('Lista Párroco Actual depende de estado canónico',list.includes("isActive ? 'Párroco Actual' : 'Histórico'"));

const failed=checks.filter(x=>!x.pass);
if(failed.length){
  console.error(`\nSACRAMENTUM V19 · FALLÓ · ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V19 · OK · ${checks.length}/${checks.length} controles.`);
