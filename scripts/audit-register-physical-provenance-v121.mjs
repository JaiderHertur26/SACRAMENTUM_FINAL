import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const file='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const master=JSON.parse(fs.readFileSync(file,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V121.json','utf8'));
const total=Number(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||0);
if(gate.passed!==25||gate.checks!==25||total!==543)throw Error('El informe V121 no demuestra la puerta de calidad indicada');
const entries={
 '06.02':'V121: cierre de lectura cruzada en artefactos/filas/archivos físicos; RLS probada con actor diocesano y ROLLBACK, acceso legítimo conservado.',
 '06.06':'V121: inventario inicial de 133 funciones SECURITY DEFINER ejecutables por authenticated; ninguna ejecutable por anon. Inspección de privilegios pendiente por función.',
 '06.09':'V121: 64 advertencias GraphQL para objetos authenticated según Security Advisor; RLS V121 elimina filtración concreta por artefactos y archivos, no todas las advertencias.',
 '13.03':'V121: origen extranjero asociado a instalación diocesana fue ilegible después del cambio RLS; evitada fuga de fichero histórico y contenido físico.',
 '13.11':'V121: SHA-256 de origen se mantiene protegido junto con su archivo, fila y artefacto físico, cada uno condicionado a jurisdicción.',
 '16.06':'V121: datos binarios/físicos de instalación y origen tratados con pertenencia doble, sin fugar datos de otra diócesis.',
 '27.02':'V121: cierre demostrado de ruta de lectura horizontal entre diócesis en tres tablas; hashes ya se negaban.',
 '27.03':'V121: acceso IDOR por origen físico extranjero reproducido: antes artefactos=1, filas=1, archivos=1; después todos=0.',
 '27.12':'V121: inventario de SECURITY DEFINER detecta 133 ejecutables por authenticated y 0 por anon; 17 no nombran auth.uid (no prueba por sí mismo inseguridad).',
 '31.10':'V121: dos pruebas ROLLBACK, cero residuos de artefactos, archivos, orígenes y diócesis QA; historial ANULACION 5+2 intacto.',
 '32.03':'V121: dos scripts SQL reproducibles, ocho pruebas contractuales estáticas, gate V121 de 543 sintéticas.',
 '32.05':'V121: hallazgo alto de lectura física ajena corregido; quedan sin cerrar seguridad de dependencias, 64 advertencias GraphQL y 133 funciones privilegiadas.',
 '32.06':'V121: pruebas RLS fallidas antes del arreglo (3 lecturas), positivas tras cuatro ALTER POLICY y prueba de no regresión local.',
 '32.07':'V121: 543/543 sintéticas, 25/25 verificaciones incluyendo build, con npm audit expresamente fuera.',
 '32.08':'V121: regresión de cero residuos QA y mismos 5 históricos pendientes y 2 vinculados.'
};
let n=0;
for(const c of master.controls){
 const ev=entries[c.id];
 if(!ev)continue;
 c.evidence??=[];
 if(!c.evidence.includes(ev))c.evidence.push(ev);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();n++;
}
fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of master.controls)totals[c.status]=(totals[c.status]||0)+1;
const report=[
 '# SACRAMENTUM · SEGURIDAD DE PROCEDENCIA FÍSICA V121',
 '',
 '**Proyecto:** C:\\SACRAMENTUM\\SACRAMENTUM_FINAL. **Rama:** audit/v113-build-tool-risk.',
 '',
 '## Hallazgo reproducido',
 '- Los objetos de legacy_physical_source_artifacts, legacy_physical_source_rows y legacy_source_files se autorizaban por instalación histórica propia aunque el origen particular perteneciera a parroquia de otra diócesis.',
 '- Prueba QA antes de V121, con JWT ficticio de cuenta autorizada pero dato de otra jurisdicción: physical=1 rows=1 hashes=0 files=1. Tres lecturas indebidas; los hashes se bloqueaban.',
 '',
 '## Corrección instalada',
 '- Migración Supabase V121: 20261022131752_isolate_physical_legacy_provenance_v121.sql.',
 '- Cuatro políticas SELECT actualizadas: artefactos físicos, filas, archivos fuente y hashes de origen.',
 '- Exige coincidencia entre instalación, origen, parroquia y jurisdicción del actor. Las filas heredan la autorización del artefacto propietario.',
 '- No hay cambios de escritura ni alteración de información auténtica en la migración.',
 '',
 '## Pruebas QA',
 '- scripts/qa-rollback-physical-provenance-rls-v121.sql: SELECT ajeno rechazado en las cuatro fuentes (0/0/0/0) con ROLLBACK.',
 '- scripts/qa-rollback-physical-provenance-legitimate-v121.sql: Diócesis, Cancillería y Administrador General mantienen lectura de expediente ficticio autorizado (1/1/1/1). La comprobación parroquial es condicional a existir un perfil parroquial activo del origen elegido.',
 '- scripts/test-physical-provenance-rls-v121.mjs: ocho comprobaciones contractuales.',
 '- Consulta posterior: 0 residuos QA en artefactos, archivos, orígenes y diócesis; ANULACION mantiene cinco pendientes y dos vinculados.',
 '',
 '## Seguridad general todavía abierta',
 '- Security Advisor: 64 objetos visibles en esquema GraphQL para authenticated. La advertencia no significa que las filas sean accesibles; revisar por objeto y rol.',
 '- 133 funciones SECURITY DEFINER ejecutables por authenticated y cero por anon; 17 de estas no mencionan literalmente auth.uid, lo que NO acredita por sí solo ausencia de validación. Auditoría funcional por RPC pendiente.',
 '- Security Advisor reporta protección contra contraseñas filtradas no habilitada; requiere cambio y verificación de configuración Auth.',
 '- npm audit y dependencias: control 30.02 continúa FALLIDO; no incluido en este gate.',
 '',
 '## Regresión',
 '- AUDITORIA_PUERTA_CALIDAD_V121.json: '+total+' pruebas sintéticas, 25/25 verificaciones incluidas 23 comprobaciones legadas y build.',
 '- Se agregaron '+n+' evidencias al plan maestro. Resumen: '+JSON.stringify(totals)+'.',
 '- Sin prueba de UI autenticada, impresión, backup completo, carga histórica real, concurrencia ni despliegue frontend.',
 '',
 'Dictamen: la exposición de procedencia física comprobada se corrigió y verificó. **No existe certificación global de SACRAMENTUM.**',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_PROCEDENCIA_FISICA_Y_RPC_V121_2026-10-22.md',report);
console.log('V121 '+JSON.stringify(totals)+' evidence='+n);
