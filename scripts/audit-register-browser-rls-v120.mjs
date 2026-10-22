import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const planPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=JSON.parse(fs.readFileSync(planPath,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V120.json','utf8'));
const browser=JSON.parse(fs.readFileSync('AUDITORIA_NAVEGADOR_ANONIMO_V119.json','utf8'));
const synth=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(gate.checks!==25||gate.passed!==25||synth!==535||browser.passed!==7||browser.failed!==0)
 throw Error('V119-V120 incompleta: no registrar resultados falsos');

const evidence={
 '06.02':'V120: dos fugas SELECT entre diócesis reproducidas y cerradas con RLS; prueba SQL con roles Chancery, Diócesis y Parroquia y referencias cruzadas. ROLLBACK.',
 '06.06':'V120: permisos de objetos no ampliados; RPC V118 intacta, RLS de lectura del archivo corregida.',
 '06.09':'V120: Supabase Advisor informa 64 objetos visibles en GraphQL a authenticated. Acceso a esquema NO equivale a fuga de filas; revisión exhaustiva pendiente.',
 '13.03':'V120: origen y fila ANULACION rechazados para otra diócesis y para parroquia/diocese contradictorias en prueba real RLS.',
 '13.10':'V119: rutas protegidas redirigen sesión anónima; V120 conserva consulta de 7 ANULACION y 2 orígenes para Cancillería. UI interna autenticada no comprobada.',
 '24.02':'V119: Chrome móvil 390x844, portada y login sin desbordamiento horizontal, captura PNG, sin sesión.',
 '24.04':'V119: Chrome escritorio 1440x900, portada pública renderizada sin error JS ni desbordamiento.',
 '24.12':'V119: 7 capturas PNG con SHA-256, evidencia del navegador anónimo local; faltan pantallas autenticadas.',
 '27.01':'V120: autorizado de bajo privilegio no puede leer origen ni fila de otra diócesis, aunque compartan instalación histórica.',
 '27.02':'V120: detección de lectura cruzada al mezclar IDs de diócesis y parroquia, corregida en políticas RLS.',
 '27.03':'V120: acceso IDOR por origen y referencia parroquial ajena reproducido con fixture y corregido con doble pertenencia.',
 '31.10':'V120: QA transaccional con diócesis/parroquias ficticias, ROLLBACK y cero residuos QA verificados.',
 '32.03':'V119-V120: pruebas Chrome reales anon 7/7 y regresión 535 sintéticas 25/25 tareas; SQL multirrol ejecutado.',
 '32.04':'V119: capturas y hashes SHA-256 por viewport/ruta, guardadas en AUDITORIA_EVIDENCIA_VISUAL_V119 (local, no Git).',
 '32.05':'V120: hallazgo de aislamiento de origen y fila histórica (gravedad alta) documentado y cerrado por RLS; 64 WARN GraphQL pendientes de revisión.',
 '32.06':'V120: evidencia antes/después de fuga entre diócesis, ALTER POLICY y prueba RLS multirrol reejecutada sin error.',
 '32.07':'V120: gate 25/25, 535 sintéticas, 23 verificadores heredados y build aprobados; npm audit omitida.',
 '32.08':'V120: siete antecedentes ANULACION intactos, 5 pendientes y 2 vinculados; cero residuos RLS ficticios.'
};
let count=0;
for(const c of master.controls){
 if(!evidence[c.id])continue;
 c.evidence??=[];
 if(!c.evidence.includes(evidence[c.id]))c.evidence.push(evidence[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();count++;
}
fs.writeFileSync(planPath,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const tally={};for(const c of master.controls)tally[c.status]=(tally[c.status]||0)+1;
const report=[
'# SACRAMENTUM · SEGURIDAD HISTÓRICA Y NAVEGACIÓN ANÓNIMA V119–V120',
'',
'## Hechos comprobados',
'- Navegador Chrome headless local en siete rutas: portada escritorio/móvil, acceso móvil y cuatro rutas institucionales protegidas.',
'- Segunda ejecución con espera explícita de render React: 7/7 PASS. La primera ejecución fría fue 5/7 por ausencia temporal de contenido renderizado al optimizar dependencias de Vite.',
'- Las cuatro rutas privadas se redirigen a / cuando el visitante no tiene sesión. No muestran expedientes.',
'- Evidencias PNG y SHA-256 en AUDITORIA_EVIDENCIA_VISUAL_V119, informe AUDITORIA_NAVEGADOR_ANONIMO_V119.json.',
'',
'## Hallazgos críticos corregidos',
'- RLS en legacy_source_origins: una instalación propia podía hacer visible a Cancillería un origen histórico mapeado a parroquia de otra diócesis; reproducido antes como visible=1.',
'- RLS en legacy_archive_records: una fila con parish_id de diócesis ajena y diocese_id propia se mostraba por una condición OR; reproducido antes como visible=1.',
'- Migración Supabase V120: supabase/migrations/20261022130415_isolate_historical_origins_by_diocese_v120.sql. Dos ALTER POLICY preservan RLS y fuerzan pertenencia coherente.',
'- Test scripts/qa-rollback-cross-diocese-rls-v120.sql: Chancery, Diocese, Parish y Admin General con filas ficticias locales, extranjeras e inconsistentes. PASS tras corrección; finaliza con ROLLBACK.',
'- La política mantiene la consulta legítima de 7 expedientes ANULACION y 2 orígenes para Cancillería.',
'- La Parroquia no puede consultar metadatos de instalaciones históricas; sí puede consultar su propio registro bajo su política.',
'',
'## Integridad post-test',
'- Archivos reales: 5 antecedentes pendientes y 2 con decreto vinculado, sin cambios.',
'- Cero residuos ficticios en orígenes, filas históricas, diócesis y parroquias V120.',
'',
'## Calidad',
'- Regresión V120: 535/535 pruebas sintéticas, 25/25 verificaciones, build de producción correcto.',
'- El control de npm audit continúa abierto/fallido; gate ejecutado con --sin-auditoria-dependencias.',
'- Supabase Advisor detecta visibilidad de 64 objetos para GraphQL authenticated. El dato requiere revisar RLS y no prueba automáticamente acceso cruzado.',
'',
'## Limitaciones precisas',
'- Las capturas son de navegación sin autenticación: no certifican UX ni permisos efectivos dentro de Cancillería, Diócesis y Parroquia.',
'- Falta navegación autenticada real y evaluación visual individual de todas las pantallas, impresión, importaciones, notificaciones, rendimiento y recuperación de backup.',
'- No se ha desplegado frontend de la rama audit/v113-build-tool-risk.',
'',
'## Estado de auditoría',
'- 325 controles, '+count+' con evidencia añadida en este ciclo. Totales: '+JSON.stringify(tally)+'.',
'- No se convirtió ninguna prueba estática en certificación integral.',
''
].join('\n');
fs.writeFileSync('AUDITORIA_NAVEGADOR_Y_RLS_V120_2026-10-22.md',report);
console.log('V120 EVIDENCIA '+count+' '+JSON.stringify(tally));
