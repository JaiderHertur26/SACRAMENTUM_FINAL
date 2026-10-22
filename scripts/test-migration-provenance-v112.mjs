import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const v111=fs.readFileSync('supabase/migrations/20261022023010_court_receipt_dual_control_assessment_v111.sql','utf8');
const v112=fs.readFileSync('supabase/migrations/20261022023434_court_clarification_workflow_v112.sql','utf8');
test('V111 guarda un dictamen de doble cotejo que nunca certifica por sí solo',()=>{
 assert.match(v111,/clarification_required/);
 assert.match(v111,/discrepancy_requires_resolution/);
 assert.match(v111,/reference_checks_concordant_not_certified/);
 assert.match(v111,/'authenticity_certified',false/);
 assert.match(v111,/'registral_effects_authorized',false/);
});
test('V111 rechaza consulta anónima y limita jurisdicción',()=>{
 assert.match(v111,/auth\.uid\(\)/);
 assert.match(v111,/v_receipt\.diocese_id is distinct from v_diocese/i);
 assert.match(v111,/REVOKE ALL ON FUNCTION.*FROM PUBLIC,anon/i);
});
test('V111 devuelve únicamente información, sin sentar ni anular partidas',()=>{
 assert.doesNotMatch(v111,/\bINSERT\s+INTO\b/i);
 assert.doesNotMatch(v111,/\bUPDATE\s+public\./i);
 assert.doesNotMatch(v111,/\bDELETE\s+FROM\b/i);
});
test('V112 incluye integridad referencial y segregación de identidad',()=>{
 assert.match(v112,/receipt_id uuid not null references public\.nullity_court_decision_receipts/);
 assert.match(v112,/constraint clarification_different_actor/);
 assert.match(v112,/constraint clarification_response_complete/);
});
test('V112 impide segundo requerimiento simultáneo por índice parcial',()=>{
 assert.match(v112,/CREATE UNIQUE INDEX nullity_court_clarification_one_open_v112/i);
 assert.match(v112,/WHERE responded_at IS NULL/i);
});
test('V112 exige doble cotejo anterior y estado sin verificar',()=>{
 assert.match(v112,/v_c<>2/);
 assert.match(v112,/v_receipt\.verification_state<>'unverified'/);
});
test('V112 asigna apertura a Diócesis y respuesta a Cancillería',()=>{
 assert.match(v112,/v_role<>'diocese'/);
 assert.match(v112,/v_role<>'chancery'/);
});
test('V112 protege frente a acceso directo y sin autenticación',()=>{
 assert.match(v112,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(v112,/REVOKE ALL ON public\.nullity_court_clarifications_v112 FROM PUBLIC,anon,authenticated/i);
 assert.match(v112,/REVOKE ALL ON FUNCTION public\.record_court_clarification_v112/i);
});
test('V112 registra auditoría pero no altera sacramentos o sentencia',()=>{
 assert.match(v112,/INSERT INTO public\.registry_audit_log/i);
 assert.doesNotMatch(v112,/\bUPDATE\s+public\.(?:decretos|marriages|baptisms|confirmations|funerals)\b/i);
 assert.doesNotMatch(v112,/\bDELETE\s+FROM\s+public\.(?:decretos|marriages|baptisms|confirmations|funerals)\b/i);
});
test('Ambas funciones usan contexto controlado en la base',()=>{
 for(const sql of [v111,v112]){
  assert.match(sql,/SECURITY DEFINER/i);
  assert.match(sql,/SET search_path TO ''/i);
 }
});
