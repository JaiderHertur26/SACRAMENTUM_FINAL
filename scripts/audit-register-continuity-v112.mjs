import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=process.cwd();
const plan='AUDITORIA_MAESTRA_CONTROLES_V90.json';
const data=JSON.parse(fs.readFileSync(plan,'utf8'));
const gate=JSON.parse(fs.readFileSync('AUDITORIA_PUERTA_CALIDAD_V112.json','utf8'));
const evidence={
 '02.03':'V111/V112: cotejo doble evaluado y aclaraciones documentadas en Supabase; autenticidad judicial real y aplicación sobre partidas continúan sin aprobar.',
 '06.06':'V111/V112: se verificaron privilegios de ejecución anon=false y authenticated=true de nuevas RPC; las demás funciones privilegiadas requieren matriz completa por rol.',
 '10.11':'V111/V112: se separó revisión documental y aclaraciones de una decisión jurídica con efectos registrales. Evidencia de migraciones locales y test de contratos, sin recorrido E2E completo.',
 '30.04':'Se copiaron al repositorio las migraciones exactas V111/V112 recuperando su definición de Supabase y se añadieron 10 verificaciones estáticas; restauración limpia pendiente.',
 '30.07':'Puerta de compilación V112 correctamente ejecutada en equipo de trabajo; no acredita pruebas visuales autenticadas ni despliegue de V111/V112.',
 '32.01':'V111/V112: fuentes SQL, pruebas y resumen de seguridad guardados en el árbol canónico. Falta catalogación forense de cada transacción E2E.'
};
for(const c of data.controls){
 if(!evidence[c.id])continue;
 c.evidence??=[];
 if(!c.evidence.includes(evidence[c.id]))c.evidence.push(evidence[c.id]);
 if(c.status==='PENDIENTE')c.status='EN_PROGRESO';
 c.updated_at=new Date().toISOString();
}
fs.writeFileSync(plan,JSON.stringify(data,null,2)+'\n');
execFileSync(process.execPath,['scripts/audit-master-plan-v90.mjs'],{stdio:'inherit'});
const groups=new Map();
const count={};
for(const c of data.controls){
 const group=groups.get(c.phase)||{area:c.area,priority:c.priority,n:0,approved:0,progress:0,fail:0};
 group.n++;
 if(c.status==='APROBADO')group.approved++;
 if(c.status==='EN_PROGRESO')group.progress++;
 if(c.status==='FALLIDO')group.fail++;
 groups.set(c.phase,group);
 count[c.status]=(count[c.status]||0)+1;
}
const lines=[
 '# SACRAMENTUM · CONTINUIDAD DE AUDITORÍA INTEGRAL V112',
 '',
 'Fecha local: 21 de octubre de 2026. Directorio canónico: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL.',
 '',
 '## Criterios innegociables',
 '- Ningún control crítico P0 se certifica por compilación o tests de patrón textual.',
 '- Pruebas ficticias aisladas o en transacciones ROLLBACK; jamás contaminar ni restaurar sobre datos auténticos.',
 '- Cada flujo prueba actor autorizado, actor sin permiso, jurisdicción propia y ajena, duplicado, concurrencia, fallo de red, trazabilidad y no regresión.',
 '- El dictamen eclesial auténtico no puede sustituirse por valoración algorítmica.',
 '- Pruebas front/back: sesión autenticada, click real, respuesta de Supabase, escritura/lectura, impresión y auditoría.',
 '',
 '## Línea de base reproducible',
 '- Controles auditables: '+data.controls.length+' en '+groups.size+' fases.',
 '- Estados: '+JSON.stringify(count)+'.',
 '- Gate de compilación/históricos/pruebas sintéticas: '+gate.passed+'/'+gate.checks+'.',
 '- Importante: ese gate se ejecutó sin npm audit. El control 30.02 permanece FALLIDO por vulnerabilidades HIGH sin remediación acreditada.',
 '- Fuentes de migraciones V111 y V112 incorporadas a supabase/migrations; cobertura de contratos con diez casos de prueba.',
 '- V111 y V112 aún NO están integradas en las pantallas; no se han desplegado como una versión funcional completa.',
 '',
 '## Estado control a control por fase',
 '',
 '| Fase | Área | Prioridad | Aprobados | En progreso | Pendientes/Fallidos |',
 '|---|---|---|---:|---:|---:|'
];
for(const [phase,g] of [...groups].sort((a,b)=>a[0]-b[0])){
 lines.push('| '+String(phase).padStart(2,'0')+' | '+g.area.replaceAll('|','/')+' | '+g.priority+' | '+g.approved+'/'+g.n+' | '+g.progress+' | '+(g.n-g.approved-g.progress)+' |');
}
lines.push('','## Orden efectivo de trabajo','',
 '1. Seguridad P0: autorizar cada RPC privilegiada por rol y alcance, prueba RLS y evitar fuga de documentos o secretos.',
 '2. Integridad documental y derecho canónico: decretos ordinarios, históricos, supletorios y Tribunal, sin efectos indebidos.',
 '3. Ciclos E2E completos de Bautismo, Confirmación, Matrimonio y Exequias, con todo su árbol de datos.',
 '4. Migración histórica: DBF, documentos, boletas, ANULACION, catálogos, hash de fuente y idempotencia.',
 '5. Uso de interfaz: entrar en todas las pantallas con todos los roles, todos los controles y dispositivos.',
 '6. Concurrencia, redes interrumpidas, reintentos, tiempos extremos y recuperación tras falla.',
 '7. Seguridad dependencias, CI/CD y despliegue verificable, separando build de pruebas funcionales.',
 '8. Restaurar respaldo en entorno desechable y comparar conteos y hashes; auditoría final independiente.',
 '',
 '## Hallazgos que impiden declarar cierre',
 '- 30.02 npm audit: FALLIDO; HIGH conocido, sin corrección comprobada.',
 '- V111/V112: definición en Supabase y SQL local, pero UI y flujo autenticado todavía sin E2E.',
 '- Matriz general de 325 controles muy incompleta: NO confundirla con cientos de pruebas sintéticas.',
 '- Concurrencia multiusuario real, restauración y QA visual total siguen pendientes.',
 '- Confirmación de validez judicial depende de autoridad competente y soporte verificable.',
 '',
 '## Regla de cierre', '',
 'Sólo cambiar un estado a APROBADO con evidencia reproducible: versión, actor, entradas, salida, fecha, rol, jurisdicción, aserciones, registros antes/después y reversión.',
 '');
fs.writeFileSync('AUDITORIA_CONTINUIDAD_INTEGRAL_V112_2026-10-21.md',lines.join('\n'),'utf8');
console.log('Informe V112 y Plan maestro actualizados sin aprobar controles por presunción.');
