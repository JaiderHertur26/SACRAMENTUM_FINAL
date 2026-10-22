import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261022020721_dual_control_court_receipt_review_v110.sql'),'utf8');
const service=fs.readFileSync(path.join(root,'src/services/nullityReceiptDualControl.js'),'utf8');
const chancery=fs.readFileSync(path.join(root,'src/pages/chancery/SacramentalDecreeArchivePage.jsx'),'utf8');
const diocese=fs.readFileSync(path.join(root,'src/pages/diocese/DiocesanDecreeOversightPage.jsx'),'utf8');

test('Tabla enlaza recepción, caso, diócesis y parroquia',()=>{
 for(const k of ['receipt_id uuid NOT NULL REFERENCES','review_case_id uuid NOT NULL REFERENCES',
    'diocese_id uuid NOT NULL REFERENCES','parish_id uuid NOT NULL REFERENCES']) assert.ok(sql.includes(k));
});
test('Se permiten únicamente dos etapas delimitadas',()=>{
 assert.match(sql,/stage IN \('chancery_reference_check','diocesan_independent_check'\)/);
});
test('Los hallazgos pueden discrepar sin aprobación automática',()=>{
 for(const k of ['reference_matches','requires_clarification','discrepancy_detected']) assert.ok(sql.includes(k));
});
test('Medios de contraste institucionales explícitos',()=>{
 for(const k of ['official_office_contact','official_email','official_letter']) assert.ok(sql.includes(k));
});
test('Exige referencia externa y explicación sustantiva',()=>{
 assert.match(sql,/length\(trim\(external_contact_reference\)\)>=12/);
 assert.match(sql,/length\(trim\(assessment_notes\)\)>=40/);
});
test('Fecha del cotejo no futura',()=>{
 assert.match(sql,/checked_on<=CURRENT_DATE/);
 assert.match(sql,/p_checked_on>CURRENT_DATE/);
});
test('Etapa única por recepción con índice único atómico',()=>{
 assert.match(sql,/UNIQUE\(receipt_id,stage\)/);
});
test('RLS habilitada y DML directo revocado',()=>{
 assert.match(sql,/ALTER TABLE public\.nullity_court_receipt_checks ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.nullity_court_receipt_checks FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON public\.nullity_court_receipt_checks TO authenticated/);
});
test('Consulta limitada por rol y jurisdicción',()=>{
 assert.match(sql,/current_app_role\(\) IN \('chancery','diocese'\)/);
 assert.match(sql,/diocese_id=public\.current_app_diocese_id\(\)/);
 assert.match(sql,/parish_id=public\.current_app_parish_id\(\)/);
});
test('RPC exige identidad activa, Cancillería o Diócesis',()=>{
 assert.match(sql,/auth\.uid\(\) IS NULL/);
 assert.match(sql,/coalesce\(u\.is_active,false\)/);
 assert.match(sql,/v_role NOT IN \('chancery','diocese'\)/);
});
test('Es imposible ejercer fuera de diócesis, parroquia o sentencia vinculada',()=>{
 for(const k of ['v_receipt.diocese_id IS DISTINCT FROM v_diocese',
'v_case.diocese_id IS DISTINCT FROM v_diocese',
'v_decree.diocese_id IS DISTINCT FROM v_diocese',
'v_parish_diocese IS DISTINCT FROM v_diocese',
'v_decree.original_record_id IS DISTINCT FROM v_case.marriage_id'])assert.ok(sql.includes(k));
});
test('Actuación bloquea la recepción para serialización',()=>{
 assert.match(sql,/WHERE id=p_receipt_id FOR UPDATE/);
});
test('Sentencia de nulidad original debe seguir vigente',()=>{
 assert.match(sql,/v_decree.tipo<>'nulidad_matrimonial'/);
 assert.match(sql,/v_decree.sacrament_type<>'matrimonio'/);
 assert.match(sql,/NOT IN \('active','vigente'\)/);
});
test('Recepción original debe seguir explícitamente sin verificar',()=>{
 assert.match(sql,/v_receipt.verification_state<>'unverified'/);
 assert.match(sql,/v_receipt.registrar_attestation<>'receipt_only_no_authenticity_or_effects'/);
});
test('Revisión de Cancillería siempre primero',()=>{
 assert.match(sql,/v_stage:='chancery_reference_check'/);
 assert.match(sql,/v_current_stage_count<>0/);
});
test('Contraste diocesano exige el cotejo anterior',()=>{
 assert.match(sql,/v_stage:='diocesan_independent_check'/);
 assert.match(sql,/IF v_first_actor IS NULL THEN/);
});
test('El segundo usuario debe ser distinto de la persona que recibió y cotejó',()=>{
 assert.match(sql,/v_first_actor IS NOT DISTINCT FROM auth\.uid\(\)/);
 assert.match(sql,/v_receipt.received_by IS NOT DISTINCT FROM auth\.uid\(\)/);
});
test('El segundo cotejo también se protege de duplicación',()=>{
 assert.match(sql,/stage='diocesan_independent_check'/);
 assert.match(sql,/Ya existe cotejo para esta etapa/);
});
test('Solo se insertan registros y eventos de auditoría',()=>{
 assert.match(sql,/INSERT INTO public\.nullity_court_receipt_checks/);
 assert.match(sql,/INSERT INTO public\.registry_audit_log/);
 assert.doesNotMatch(sql,/^\s*UPDATE\s+public\./im);
 assert.doesNotMatch(sql,/^\s*DELETE\s+FROM\s+public\./im);
});
test('Auditoría indica que no se autentica ni ejecuta',()=>{
 assert.match(sql,/'original_document_still_unverified',true/);
 assert.match(sql,/'authenticity_certified',false/);
 assert.match(sql,/'registral_effects_executed',false/);
});
test('RPC no disponible para anon ni PUBLIC',()=>{
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.record_court_receipt_independent_check_v110/);
 assert.match(sql,/FROM PUBLIC,anon/);
});
test('UI compartida recoge rol, hallazgo, canal y evidencia',()=>{
 assert.match(service,/FINDINGS/);
 assert.match(service,/CHANNELS/);
 assert.match(service,/p_external_contact_reference: reference\.trim\(\)/);
 assert.match(service,/p_assessment_notes: notes\.trim\(\)/);
});
test('UI obliga confirmación de ausencia de efectos',()=>{
 assert.match(service,/No certifica autenticidad judicial/);
 assert.match(service,/no altera partidas ni notas/);
});
test('Cancillería puede iniciar cotejo desde una recepción todavía sin cotejo',()=>{
 assert.match(chancery,/recordChanceryReceiptCheck/);
 assert.match(chancery,/submitCourtReceiptCheck/);
 assert.match(chancery,/Registrar cotejo de Cancillería/);
});
test('Cancillería ve necesidad del control independiente',()=>{
 assert.match(chancery,/Contraste diocesano independiente pendiente/);
});
test('Diócesis ve sus comunicaciones y el primer cotejo',()=>{
 assert.match(diocese,/from\('nullity_court_decision_receipts'\)/);
 assert.match(diocese,/from\('nullity_court_receipt_checks'\)/);
 assert.match(diocese,/Primero debe realizarse el cotejo de Cancillería/);
});
test('Solo Diócesis puede enviar el segundo cotejo desde supervisión',()=>{
 assert.match(diocese,/recordIndependentCheck/);
 assert.match(diocese,/stage: 'diocesan_independent_check'/);
 assert.match(diocese,/Registrar contraste independiente de Diócesis/);
});
test('La UI no muestra autenticación o revocación aprobada',()=>{
 assert.match(diocese,/no autentica sentencia/);
 assert.doesNotMatch(diocese,/execute_nullity_revocation/);
 assert.doesNotMatch(chancery,/execute_nullity_revocation/);
});
