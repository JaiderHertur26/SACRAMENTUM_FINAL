import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const masterPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const data=JSON.parse(fs.readFileSync(masterPath,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V114.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('AUDITORIA_CASOS_FICTICIOS_INTEGRALES_V114.json','utf8'));
const entries={
 '02.03':'V114: expediente ficticio de nulidad, doble cotejo, aclaración y respuesta; sentencia Matrimonio y recepción conservan estado; ejecución SQL ROLLBACK (scripts/qa-rollback-tribunal-v114.sql).',
 '06.06':'V113/V114: lectura de aclaraciones sólo Cancillería/Diócesis; Parroquia rechazada en SQL. Las otras RPC pendientes de matriz completa.',
 '10.11':'V114: ensayo transaccional nulidad ficticia con dos funcionarios y respuesta sin efectos; UI visual autenticada y aval canónico externo pendientes.',
 '12.01':'V114: documentos nuevos e históricos de cuatro sacramentos, emisión Cancillería positiva, Diócesis, Parroquia y Admin General rechazados; no cubre todos los demás decretos.',
 '12.06':'V114: 8 documentos ficticios, cero cambios en partidas y notas durante transacción; fuente scripts/qa-rollback-documentary-v114.sql, ROLLBACK.',
 '12.08':'V114: archivo consultado por diocese_id y parish_id sobre misma fila canónica, 52 casos sintéticos; falta prueba UI y RLS real de ambos actores.',
 '12.11':'V114: un segundo decreto con igual número es rechazado en ensayo documental reversible.',
 '13.01':'V114: cuatro documentos históricos ficticios en parroquia no operativa; fuente histórica obligatoria, sin fingir nueva emisión; ROLLBACK.',
 '13.02':'V114: expediente histórico queda archived, recordOrigin historical_archive; ensayo reversión no ejecutada. Pendiente auditoría importación real completa.',
 '13.10':'V114: evidencia contractual de archivo canónico en doble rol, sin duplicar registros físicos; falta cotejo visual RLS.',
 '30.07':'V114: compilación local Vite aprobada junto con 501 pruebas sintéticas; no equivale a despliegue.',
 '31.07':'V114: matrices ficticias 52 variantes del modelo de decretos y dos ejecuciones SQL ROLLBACK; prueba integral por los cuatro sacramentos pendiente.',
 '31.10':'V114: tras dos ensayos SQL reversibles, cero registros QA persistidos en seis entidades verificadas.',
 '32.01':'V114: banco de 7.800 escenarios planificados, separados de pruebas reales y sintéticas con etiqueta NO_EJECUTADO.',
 '32.04':'V114: scripts SQL reversibles y prueba de origen de migraciones versionados; todavía faltan capturas de UI.'
};
for(const c of data.controls){
 if(!entries[c.id])continue;
 c.evidence??=[];
 if(!c.evidence.includes(entries[c.id]))c.evidence.push(entries[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();
}
fs.writeFileSync(masterPath,JSON.stringify(data,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const totals={};for(const c of data.controls)totals[c.status]=(totals[c.status]||0)+1;
const report=[
 '# SACRAMENTUM · AUDITORÍA DE DECRETOS Y PRUEBAS FICTICIAS V114',
 '',
 'Proyecto: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL; versión de prueba local, no publicado.',
 '',
 '## Hechos ejecutados y verificables',
 '- Migraciones V111/V112/V113 aplicadas en Supabase. V113 replica la lectura de aclaraciones con autorización de Cancillería o Diócesis y sin lectura directa de tabla.',
 '- Panel compartido de recepción judicial y aclaraciones conectado a Cancillería y Diócesis. Build Vite: aprobado; faltan pruebas visuales con sesión real.',
 '- scripts/qa-rollback-tribunal-v114.sql: expediente matrimonial + nulidad + doble cotejo contradictorio + requerimiento + rechazo duplicado + Parroquia denegada para responder/consultar + respuesta Cancillería.',
 '- scripts/qa-rollback-documentary-v114.sql: cuatro sacramentos, decretos nuevos y antecedentes documentales históricos; permisos indebidos rechazados, colisión de número, histórica sin procedencia y expedición nueva en contenedor histórico rechazadas.',
 '- Después de reejecución de las transacciones: cero QA en casos, recepciones, cotejos, aclaraciones, Matrimonios y decretos de prueba.',
 '- 52 combinaciones sintéticas de tipo, origen y parroquia con 56 pruebas: aprobado.',
 '- Puerta V114: '+gate.passed+'/'+gate.checks+' verificaciones, '+(gate.tasks.find(x=>x.name==='pruebas-sinteticas')?.stdoutSnippet.match(/tests ([0-9]+)/)?.[1]||'ver reporte')+' pruebas sintéticas (según informe); incluye 23 verificadores históricos y build.',
 '',
 '## Banco maestro ficticio SIN ejecutar',
 '- '+catalog.caseCount+' casos catalogados de '+catalog.controls+' criterios × cuatro roles × seis variantes adversariales.',
 '- Ejecutados '+catalog.executed+', aprobados '+catalog.passed+'. Esto es planificación operativa, no una certificación.',
 '',
 '## Hallazgos abiertos',
 '- 30.02 npm audit: FALLIDO por alertas altas previas y fallo de red al intentar actualizar; no se declara seguro.',
 '- No están certificados los ciclos completos de celebración-asiento-impresión-importación para los cuatro sacramentos.',
 '- No están completas todas las pruebas RLS y RPC entre diócesis, ni la concurrencia real entre sesiones.',
 '- No está comprobada visualmente cada pantalla en Firefox y móvil, ni restauración de respaldo en entorno desechable.',
 '- La legitimidad del documento judicial debe verificarse por autoridad competente; ningún algoritmo convierte cotejos en aprobación.',
 '',
 '## Estado de los 325 controles',
 JSON.stringify(totals),
 '',
 'La fuente canónica sigue siendo AUDITORIA_MAESTRA_CONTROLES_V90.json. Ningún nuevo control se ha marcado APROBADO solo por estos ensayos.',
 'Todas las pruebas SQL de esta fase finalizan con ROLLBACK.',
 ''
].join('\n');
fs.writeFileSync('AUDITORIA_DECRETOS_Y_FICTICIOS_V114_2026-10-21.md',report);
console.log('Reporte V114 actualizado: '+JSON.stringify(totals));
