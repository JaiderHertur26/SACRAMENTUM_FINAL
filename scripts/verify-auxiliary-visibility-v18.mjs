import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const sql=read('supabase/applied-history/SACRAMENTUM_AUXILIARY_RLS_VISIBILITY_V18.sql');
const page=read('src/pages/parish/auxiliary/ParrocosList.jsx');
const service=read('src/services/catalogsService.js');
const migration=read('src/pages/admin/LegacyMigrationCenterPage.jsx');

const checks=[];
const check=(name,ok)=>{ const pass=Boolean(ok); checks.push({name,pass}); console.log(pass?'✓':'✗',name); };

for (const table of ['parrocos','iglesias','ciudades','obispos','diocesis','mis_datos']) {
  check(`V18 RLS: ${table} revoca anon`, sql.includes(`public.${table}`) && sql.includes('revoke all on table'));
}

check('Párrocos SELECT usa ámbito institucional', sql.includes('create policy parrocos_select_scoped') && sql.includes('public.can_access_parish(parish_id)'));
check('Párrocos WRITE limita parroquia propietaria', sql.includes('create policy parrocos_write_owner') && sql.includes("public.current_app_role()='parish'") && sql.includes('parish_id=public.current_app_parish_id()'));
check('Ciudades usa context_id como parroquia', sql.includes('create policy ciudades_select_scoped') && sql.includes('public.can_access_parish(context_id)'));
check('Mis Datos contempla parroquia y diócesis', sql.includes('create policy mis_datos_select_scoped') && sql.includes('entity_id=public.current_app_diocese_id()'));

check('ParrocosList usa columnas reales', page.includes('nombre: dbItem.nombre') && page.includes('fechaIngreso: dbItem.fecha_ingreso') && page.includes('fechaSalida: dbItem.fecha_salida'));
check('ParrocosList conserva legacy_code', page.includes('legacyCode: payload.legacy_code'));
check('Código Da Fe prioriza legacy real', page.includes('p.legacyCode') && page.includes('calculatedCode'));
check('Servicio cachea columnas reales', service.includes('legacyCode: row.payload?.legacy_code') && service.includes('fechaIngreso: row.fecha_ingreso'));

check('Centro diferencia materialización', migration.includes('Importación y publicación completadas'));
check('Centro alerta materialización incompleta', migration.includes('Importación aplicada con materialización incompleta'));
check('Centro informa filas visibles', migration.includes('visibles en Datos Auxiliares'));

const failed=checks.filter(x=>!x.pass);
if(failed.length){
  console.error(`\nSACRAMENTUM V18 · FALLÓ · ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V18 · OK · ${checks.length}/${checks.length} controles.`);
