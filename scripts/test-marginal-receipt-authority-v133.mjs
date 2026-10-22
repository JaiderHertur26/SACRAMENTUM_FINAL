import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261022155208_separate_marginal_note_and_notification_receipt_authority_v133.sql');
const roleMatrix=read('scripts/qa-rollback-marginal-note-notification-matrix-v133.sql');
const cross=read('scripts/qa-rollback-cross-parish-notes-receipts-v133.sql');
const noteBaseline=read('scripts/qa-rollback-manual-note-admin-role-v133.sql');
const receiptBaseline=read('scripts/qa-rollback-notification-read-spoof-v133.sql');
const byName=name=>{
 const start=migration.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 assert.ok(start>=0,'Function not in migration: '+name);
 const opener=migration.indexOf('AS $function$',start);
 const end=migration.indexOf('$function$',opener+13);
 assert.ok(end>start,'Function incomplete: '+name);
 return migration.slice(start,end+11);
};
test('V133 redefine las tres RPC implicadas y conserva los originales íntegros',()=>{
 for(const name of ['create_manual_marginal_note','mark_official_notification_read','archive_official_notification'])
  assert.match(byName(name),/SECURITY DEFINER/);
});
test('V133 solo Parroquia y Cancillería pueden agregar notas marginales manuales',()=>{
 const ddl=byName('create_manual_marginal_note');
 assert.match(ddl,/v_role is null or v_role not in \('parish','chancery'\)/);
 assert.doesNotMatch(ddl,/v_role not in \('parish','chancery','diocese','admin_general'\)/);
 assert.match(ddl,/not public\.can_access_parish\(p_parish_id\)/);
 assert.match(ddl,/v_role='parish' and p_parish_id is distinct from public.current_app_parish_id\(\)/);
});
test('V133 notas de impresión obligatoria siguen reservadas a autoridad superior',()=>{
 const ddl=byName('create_manual_marginal_note');
 assert.match(ddl,/lower\(p_print_policy\)='required' and v_role='parish'/);
 assert.match(ddl,/print_policy,print_default/);
 assert.match(ddl,/insert into public.registry_audit_log/);
});
test('V133 lectura parroquial solo la puede confirmar destinataria',()=>{
 const ddl=byName('mark_official_notification_read');
 assert.match(ddl,/public.current_app_role\(\)='parish' and v_row.receiver_parish_id=public.current_app_parish_id\(\)/);
 assert.doesNotMatch(ddl,/public.is_app_admin\(\)/);
 assert.doesNotMatch(ddl,/public.current_app_role\(\) in \('chancery','diocese'\)/);
 assert.match(ddl,/set status='read', read_at/);
});
test('V133 archivar acuses oficiales deja de ser acción de Admin General',()=>{
 const ddl=byName('archive_official_notification');
 assert.match(ddl,/public.current_app_role\(\)='parish' and v_row.receiver_parish_id=public.current_app_parish_id\(\)/);
 assert.doesNotMatch(ddl,/public.is_app_admin\(\)/);
 assert.match(ddl,/set status='archived'/);
 assert.match(ddl,/insert into public.registry_audit_log/);
});
test('V133 matriz cubre cuatro roles y ocho intentos improcedentes',()=>{
 for(const role of ["'admin_general'","'diocese'","'chancery'","'parish'"])assert.ok(roleMatrix.includes(role));
 assert.match(roleMatrix,/v_allowed<>2 OR v_denied<>8 OR v_read<>1 OR v_archived<>1/);
 assert.match(roleMatrix,/v_note_count<>2/);
 assert.match(roleMatrix,/v_status<>'archived'/);
});
test('V133 matriz comprueba recepción efectiva y que no haya lectura por tercero',()=>{
 assert.match(roleMatrix,/v_read_at IS NULL/);
 assert.match(roleMatrix,/LIKE '%No autorizado%'/);
 assert.match(roleMatrix,/LIKE '%Sólo la parroquia destinataria%'/);
});
test('V133 aislamiento horizontal de Parroquia con avisos y libros ajenos',()=>{
 assert.match(cross,/QA-V133-PARROQUIA-AJENA/);
 assert.match(cross,/v_denied<>3/);
 assert.match(cross,/status='pending' AND read_at IS NULL/);
 assert.match(cross,/EXISTS\(\s*SELECT 1 FROM public.marginal_notes/);
});
test('V133 reproducción anterior en SQL conservada como prueba forense',()=>{
 assert.match(noteBaseline,/V133-CONFIRMED: admin_general escribió nota sacramental/);
 assert.match(receiptBaseline,/V133-CONFIRMED: Diócesis marcó como leída/);
});
for(const [label,body]of [['matriz',roleMatrix],['horizontal',cross],['baseline-nota',noteBaseline],['baseline-acuse',receiptBaseline]]){
 test('V133 '+label+' no puede persistir datos de laboratorio',()=>{
  assert.match(body,/^BEGIN;$/m);
  assert.match(body,/ROLLBACK;\s*$/);
  assert.doesNotMatch(body,/^\s*COMMIT\b/im);
 });
}
