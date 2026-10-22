import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=x=>fs.readFileSync(x,'utf8');
const migration=read('supabase/migrations/20261022160304_guard_cancelled_physical_notifications_v134.sql');
const baseline=read('scripts/qa-rollback-physical-notification-cancelled-baseline-v134.sql');
const matrix=read('scripts/qa-rollback-physical-notification-source-status-v134.sql');
const scope=read('scripts/qa-rollback-physical-notification-scope-v134.sql');
const confirm=read('scripts/qa-rollback-physical-confirmation-source-v134.sql');
const digital=read('scripts/qa-rollback-digital-notification-unlinked-baseline-v135.sql');

test('V134 mantiene la firma RPC física anterior y su autorización parroquial',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public.process_manual_matrimonial_notification_physical\(p_recipient_id uuid\)/);
 assert.match(migration,/SECURITY DEFINER/);
 assert.match(migration,/lower\(coalesce\(up.role,''\)\)='parish'/);
 assert.match(migration,/v_row.receiver_parish_id is distinct from v_parish/);
});
test('V134 no permite un destinatario archivado u otro estado atípico',()=>{
 assert.match(migration,/v_row.status,'pending'\)\) NOT IN \('pending','read'\)/);
 assert.match(migration,/Sólo una notificación pendiente o leída puede certificarse en libro físico/);
});
test('V134 bloquea fuentes canceladas, revertidas y archivadas ANTES de procesar destinatario',()=>{
 for(const token of ["'cancelled'","'reversed'","'revertida'","'archived'","'anulada'","'annulled'"])
  assert.ok(migration.includes(token),token);
 const block=migration.indexOf('El documento de origen está cancelado');
 const update=migration.indexOf('update public.matrimonial_notification_recipients');
 assert.ok(block>=0 && update>=0 && block<update);
 assert.match(migration,/using errcode='23514'/);
});
test('V134 bloquea incoherencia de diócesis en la fuente antes de certificar',()=>{
 assert.match(migration,/v_doc.diocese_id IS DISTINCT FROM v_diocese/);
 assert.match(migration,/Documento fuera de la diócesis/);
 assert.match(migration,/using errcode='42501'/);
});
test('V134 bloquea carreras de estado de origen con lectura FOR SHARE',()=>{
 assert.match(migration,/from public.matrimonial_notifications\s+where id=v_row.notification_id\s+for share/i);
 assert.match(migration,/from public.matrimonial_notification_recipients\s+where id=p_recipient_id\s+for update/i);
});
test('V134 preserva procesamiento legítimo de matrimonio y confirmación física',()=>{
 assert.match(migration,/if v_type not in \('matrimonio','confirmacion'\)/);
 assert.match(migration,/set status='processed'/);
 assert.match(migration,/'physicalNoteCertified',true/);
});
test('V134 no fabrica dos constancias al repetir certificado ya procesado',()=>{
 assert.match(migration,/if lower\(coalesce\(v_row.status,'pending'\)\)='processed' then/);
 assert.match(matrix,/v_audit<>1/);
 assert.match(matrix,/SELECT \* INTO STRICT v_result FROM public.process_manual_matrimonial_notification_physical\(v_recipient\)/);
});
test('V134 laboratorio conserva evidencia original de falla confirmada',()=>{
 assert.match(baseline,/V134-CONFIRMED/);
 assert.match(baseline,/'matrimonio','cancelled'/);
});
test('V134 matriz de seis estados exige cinco denegaciones, un éxito y sin cambios en errores',()=>{
 for(const status of ['cancelled','reversed','revertida','archived','anulada','sent'])
  assert.ok(matrix.includes("'"+status+"'"));
 assert.match(matrix,/v_denied<>6 OR v_accepted<>1/);
 assert.match(matrix,/IF v_status<>'pending' OR v_note_applied THEN/);
});
test('V134 laboratorio rechaza rol Diocesan en libro parroquial',()=>{
 assert.match(matrix,/role='diocese'/);
 assert.match(matrix,/V134-FAIL: rol diocesano/);
});
test('V134 laboratorio verifica diócesis ajena y destinatario archivado',()=>{
 assert.match(scope,/QA-V134-DIOCESIS-AJENA/);
 assert.match(scope,/foreign_diocese/);
 assert.match(scope,/archived_recipient/);
 assert.match(scope,/v_denied<>2/);
});
test('V134 Confirmación física cancelada es rechazada y activa aprobada',()=>{
 assert.match(confirm,/notification_type,status,payload/);
 assert.match(confirm,/'confirmacion'/);
 assert.match(confirm,/ARRAY\['cancelled','sent'\]/);
 assert.match(confirm,/v_denied<>1 OR v_accepted<>1/);
});
test('V135 confirma protección digital preexistente, sin crear migración innecesaria',()=>{
 assert.match(digital,/debe vincular una partida digital o certificar el asiento físico/);
 assert.match(digital,/v_status<>'pending'/);
 assert.match(digital,/process_matrimonial_notification_recipient\(v_recipient\)/);
});
for(const [name,body]of [
 ['falla histórica',baseline],['estados',matrix],['jurisdicción',scope],
 ['confirmacion',confirm],['defensa digital',digital]
]){
 test('Rollback obligatorio en '+name,()=>{
  assert.match(body,/^BEGIN;$/m);
  assert.match(body,/ROLLBACK;\s*$/);
  assert.doesNotMatch(body,/^\s*COMMIT\b/im);
 });
}
