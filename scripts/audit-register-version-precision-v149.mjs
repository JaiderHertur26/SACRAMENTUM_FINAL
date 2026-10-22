import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const gate = read('AUDITORIA_PUERTA_CALIDAD_V149.json');
const tests = Number(gate.tasks.find(t => t.name === 'pruebas-sinteticas')?.stdoutSnippet.match(/tests (\d+)/)?.[1] || 0);
const audits = gate.tasks.filter(t => t.name.startsWith('dependencias-'));
if (tests !== 858 || gate.checks !== 28 || gate.passed !== 28 || gate.failed !== 0 ||
  audits.length !== 2 || audits.some(t => !t.ok || t.findingCounts?.total !== 0)) {
  throw new Error('V149 no cumple la puerta de calidad');
}

const planPath = 'AUDITORIA_MAESTRA_CONTROLES_V90.json';
const plan = read(planPath);
const evidence = {
  '06.06': 'V149: comparación de versiones registrales a microsegundos al validar constancias de impresión; fuente SQL V148 sin cambios.',
  '12.07': 'V149: antes de solicitar impresión, cliente exige updated_at canónico de partida; ausencia detiene operación.',
  '14.04': 'V149: el cotejo Date.parse perdía microsegundos; ahora se comprueban seis dígitos y zona horaria.',
  '14.06': 'V149: Bautismo y Confirmación verifican transporte de updated_at canónico y requieren versión válida en impresión.',
  '16.06': 'V149: Matrimonio y Exequias verifican updated_at desde SELECT * canónico y detienen impresión sin versión.',
  '27.04': 'V149: constancia de auditoría confronta versión del servidor y del cliente a precisión PostgreSQL, no milisegundos.',
  '27.05': 'V149: la impresión client-side se bloquea antes del RPC si no existe versión de partida recuperada.',
  '31.07': 'V149: 22 pruebas sintéticas reversibles nuevas, sin escritura en Supabase; variantes de husos horarios, microsegundos y versiones ausentes.',
  '32.03': 'V149: 858/858 pruebas sintéticas integradas; 28/28 comprobaciones en puerta estricta local.',
  '32.07': 'V149: build, verificadores, CSS y npm audit completo y producción aprobados; cero vulnerabilidades según reportes.',
  '32.08': 'V149: endurecimiento exclusivamente local, sin despliegue frontend, sin ensayo de papel ni concurrencia independiente.'
};
let updated = 0;
for (const control of plan.controls) {
  const statement = evidence[control.id];
  if (!statement) continue;
  control.evidence ??= [];
  if (!control.evidence.includes(statement)) control.evidence.push(statement);
  control.updated_at = new Date().toISOString();
  updated++;
}
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
execFileSync(process.execPath, ['scripts/audit-master-plan-v90.mjs'], {stdio:'inherit'});
const counts = {};
for(const control of plan.controls) counts[control.status]=(counts[control.status]||0)+1;
if (counts.APROBADO!==10 || (counts.FALLIDO||0)!==0) throw new Error('Estados maestros inesperados');
const report = [
 '# SACRAMENTUM — COTEJO REGISTRAL DE MICROSEGUNDOS Y VERSIÓN OBLIGATORIA · V149',
 '',
 '## Hallazgo real y corrección',
 '- Después de V148, el disparador PostgreSQL diferencia ediciones por microsegundos; sin embargo, verifyRegistryPrintReceipt usaba Date.parse, que descarta las últimas tres cifras en fechas con seis decimales. Dos versiones distintas del mismo milisegundo podían parecer iguales en esa comprobación de cliente.',
 '- registerRegistryPrint aún omitía expected_record_updated_at cuando el registro de pantalla no proporcionaba updated_at. El backend V143 permitía solicitudes retrocompatibles sin este campo, por lo que la ruta nueva de impresión no forzaba protección de versión.',
 '- En V149 se usa parseRegistryVersionMicros para cotejar epoch microseconds con BigInt sin perder resolución ni confundir zonas horarias; si la versión falta o es inválida, la función de impresión falla antes de llamar a Supabase.',
 '',
 '## Cobertura comprobada',
 '- script: scripts/test-registry-version-microseconds-v149.mjs; 22 ensayos de formato, instante, microsegundo y contrato de llamadas.',
 '- Lectores examinados: Bautismos, Confirmaciones, Matrimonios, Exequias. Las cinco rutas de impresión de cuatro sacramentos remiten expectedRecordUpdatedAt.',
 '- Gate local estricta: '+gate.passed+'/'+gate.checks+' verificadores, '+tests+'/'+tests+' pruebas sintéticas, npm audit producción y completo = 0.',
 '- Código incorporado a scripts/audit-gate-v90.mjs y .github/workflows/sacramentum-auditoria-v90.yml.',
 '- Sin escrituras nuevas a Supabase ni creación de datos de prueba persistentes; la modificación V149 es frontend y pruebas.',
 '',
 '## Pendientes y límites',
 '- No se probó la impresión en papel, ni DOM exacto en navegador autenticado, ni concurrencia con dos conexiones independientes.',
 '- No se afirma que el servidor certifique el hash SHA-256 del HTML: sigue siendo una huella calculada por el cliente.',
 '- No se desplegó frontend. Una pantalla con caché obsoleta o sin updated_at ahora detiene la impresión y requiere cargar la partida canónica.',
 '- La auditoría maestra continúa con '+JSON.stringify(counts)+'; evidencia V149 añadida a '+updated+' controles existentes, sin promoverlos a APROBADO.',
 '',
 '**Dictamen:** corrección local verificada y reversible, control documental más exigente, sin afirmar certificación de una salida física.'
];
fs.writeFileSync('AUDITORIA_VERSION_IMPRESION_PRECISION_V149_2026-10-22.md',report.join('\n')+'\n');
console.log('V149 '+JSON.stringify(counts)+' CONTROLES='+updated+' TESTS='+tests+' GATE='+gate.passed+'/'+gate.checks);
