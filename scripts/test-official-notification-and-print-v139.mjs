import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261022170342_guard_official_notification_terminal_states_v139.sql');
const marker=migration.indexOf('-- mark_official_notification_read');
const archive=migration.slice(0,marker),marked=migration.slice(marker);
const baselineArchive=read('scripts/qa-rollback-cancelled-notice-archive-baseline-v139.sql');
const baselineRead=read('scripts/qa-rollback-processed-notice-read-baseline-v139.sql');
const matrix=read('scripts/qa-rollback-notice-status-transitions-v139.sql');
const b=read('src/components/modals/ViewBaptismPartidaModal.jsx');
const c=read('src/components/modals/ViewConfirmationPartidaModal.jsx');
const m=read('src/components/modals/ViewMarriagePartidaModal.jsx');
const f=read('src/pages/parish/FuneralPartidasPage.jsx');
const service=read('src/services/marginalNotesV2Service.js');

test('V139 mantiene funciones privilegiadas solo para acceso parroquial destinatario',()=>{
 for(const code of [archive,marked]){
  assert.match(code,/SECURITY DEFINER/);
  assert.match(code,/public.current_app_role\(\)='parish'/);
  assert.match(code,/v_row.receiver_parish_id=public.current_app_parish_id\(\)/);
 }
});
test('V139 cancela posibilidad de archivar aviso de decreto revocado',()=>{
 assert.match(archive,/in \('cancelled','reversed','revertida','annulled','anulada'\)/);
 assert.match(archive,/Una comunicación cancelada o revertida no puede archivarse como recibida/);
});
test('V139 nunca crea un acuse de lectura al archivar un aviso pendiente',()=>{
 assert.match(archive,/not in \('read','processed'\)/);
 assert.match(archive,/v_row.read_at is null/);
 assert.match(archive,/read_at=v_row.read_at/);
 assert.doesNotMatch(archive,/read_at=coalesce\(read_at,now\(\)\)/);
});
test('V139 aviso archivado no puede archivarse una segunda vez',()=>{
 assert.match(archive,/La comunicación ya se encontraba archivada/);
});
test('V139 processed no debe degradarse a read al marcar lectura',()=>{
 assert.match(marked,/in \('pending','unread'\) then/);
 assert.match(marked,/in \('read','processed','archived','cancelled'\) then/);
 assert.match(marked,/Operación idempotente/);
});
test('V139 protege contra status de comunicación no admitidos',()=>{
 assert.match(marked,/Estado de comunicación no válido para marcar lectura/);
 assert.match(marked,/using errcode='23514'/);
});
test('V139 reproducción previa muestra restauración falsa del aviso cancelado',()=>{
 assert.match(baselineArchive,/V139-CONFIRMED/);
 assert.match(baselineArchive,/v_status='archived'/);
 assert.match(baselineArchive,/v_read_at IS NOT NULL/);
});
test('V139 reproducción previa muestra degradación processed a read',()=>{
 assert.match(baselineRead,/V139-CONFIRMED/);
 assert.match(baselineRead,/v_after='read'/);
});
test('V139 prueba matriz de cinco estados con un solo rol receptor legítimo',()=>{
 for(const status of ['v_pending','v_read','v_processed','v_cancelled','v_archived'])assert.ok(matrix.includes(status));
 assert.match(matrix,/v_positive<>7 OR v_denied<>4/);
 assert.match(matrix,/role='diocese'/);
});
test('V139 matriz verifica que se rechace archivo sin lectura y sobre cancelled',()=>{
 assert.match(matrix,/V139-FAIL: archivo sin lectura previa permitido/);
 assert.match(matrix,/V139-FAIL: pudo archivar cancelled/);
 assert.match(matrix,/EXCEPTION WHEN check_violation/);
});
test('V139 prueba positiva conserva processed_at y lectura archivada',()=>{
 assert.match(matrix,/v_status<>'processed' OR v_processed_at IS NULL/);
 assert.match(matrix,/v_status<>'archived' OR v_processed_at IS NULL/);
});
for(const [name,sql] of [['baseline archivo',baselineArchive],['baseline lectura',baselineRead],['matriz',matrix]]){
 test('V139 '+name+' es reversible y nunca persiste pruebas',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
for(const [name,code,handler] of [
 ['Bautismo',b,'ejecutarImpresion'],['Confirmación',c,'ejecutarImpresion'],
 ['Matrimonio',m,'handlePrint']
]){
 test('V139 '+name+' registra antes de abrir iframe de impresión y bloquea ante error',()=>{
  assert.ok(code.includes('const '+handler+' = async () => {'));
  const h=code.slice(code.indexOf('const '+handler+' = async () => {'));
  assert.ok(h.indexOf('await registerRegistryPrint(')>=0);
  assert.ok(h.indexOf('await registerRegistryPrint(')<h.indexOf("document.createElement('iframe')"));
  assert.match(h,/Impresión detenida: falta constancia de auditoría/);
  assert.match(h,/catch \(error\)/);
  assert.match(h,/variant: 'destructive'/);
  assert.match(h,/return;/);
  assert.doesNotMatch(h.slice(0,h.indexOf("document.createElement('iframe')")),/\.catch\(error => console.warn/);
 });
}
test('V139 Exequias exige constancia previa tanto para partida como para boleta',()=>{
 for(const name of ['printCertificate','printFuneralSlip']){
  const signature='const '+name+' = async (';
  const start=f.indexOf(signature),end=f.indexOf('\n  };',start);
  assert.ok(start>=0&&end>start,name);
  const block=f.slice(start,end);
  assert.match(block,/await registerRegistryPrint/);
  assert.ok(block.indexOf('await registerRegistryPrint(')<block.indexOf('popup.document.write('));
  assert.match(block,/popup.close\(\)/);
  assert.match(block,/Impresión detenida: falta constancia de auditoría/);
 }
});
test('V139 servicio de impresión no permite éxito silencioso con parroquia o partida ausente',()=>{
 assert.match(service,/if \(!parishId \|\| !sacramentId\) throw new Error/);
 assert.doesNotMatch(service,/if \(!parishId \|\| !sacramentId\) return null/);
});
