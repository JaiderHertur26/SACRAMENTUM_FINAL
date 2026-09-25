import fs from 'node:fs';

const checks=[];
const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
const read=(p)=>fs.readFileSync(p,'utf8');

const page=read('src/pages/parish/FuneralRegistryPage.jsx');
const service=read('src/services/funeralService.js');
const sacraments=read('src/services/sacramentsService.js');
const baptisms=read('src/pages/parish/BaptismPartidasPage.jsx');
const sql=read('supabase/applied-history/SACRAMENTUM_EXEQUIAS_BAUTISMO_FALLECIDO_V7.sql');

check('Exequias permite buscar Bautismos',page.includes('Buscar en Bautismos') && page.includes('searchBaptismsForFuneralCloud'));
check('Formulario conserva baptism_record_id',page.includes('baptism_record_id'));
check('Selección autocompleta identidad y padres',page.includes('nombre_padre: row.nombre_padre') && page.includes('nombre_madre: row.nombre_madre'));
check('Bautismo se agrega a sacramentos recibidos',page.includes("'Bautismo'"));
check('Servicio limita búsqueda a parroquia',service.includes(".eq('parish_id', parishId)"));
check('Servicio excluye partidas no vigentes',service.includes(".not('status', 'in'"));
check('Lector Bautismo expone isDeceased',sacraments.includes('isDeceased: Boolean('));
check('Partidas muestra marca Fallecido',baptisms.includes('Fallecido') && baptisms.includes('r.isDeceased'));
const baptismUpdates=[...sql.matchAll(/update\s+public\.baptisms\s+set\s+([\s\S]*?)\s+where\s+/gi)].map(m=>m[1]);
check('SQL no altera status canónico de Bautismo',baptismUpdates.length>0 && baptismUpdates.every(setClause=>!/(^|[,\s])status\s*=/i.test(setClause)));
check('SQL agrega vínculo Exequia-Bautismo',sql.includes('add column if not exists baptism_id uuid references public.baptisms'));
check('SQL marca is_deceased al asentar',sql.includes('set is_deceased=true'));
check('SQL crea nota marginal de defunción',sql.includes("'bautismo','defuncion'"));
check('SQL valida misma parroquia',sql.includes('b.parish_id=new.parish_id'));
check('SQL revierte marca cuando corresponde',sql.includes('set is_deceased=false'));

const failed=checks.filter(x=>!x.ok);
for(const c of checks) console.log(`${c.ok?'✓':'✗'} ${c.name}`);
if(failed.length){ console.error(`\nV7 FALLÓ: ${failed.length} incidencia(s).`); process.exit(1); }
console.log(`\nEXEQUIAS ↔ BAUTISMO V7 · ${checks.length} invariantes OK.`);