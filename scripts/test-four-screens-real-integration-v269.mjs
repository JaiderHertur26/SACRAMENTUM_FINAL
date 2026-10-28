import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const v263=read('scripts/staged-v263-four-real-seat-rpcs.sql');
const v264=read('scripts/staged-v264-parish-ledger-context.sql');
const v265=read('scripts/staged-v265-attest-new-celebration.sql');
const q263=read('scripts/ci-four-real-seat-rpcs-v263.sh');
const q265=read('scripts/ci-celebration-attestation-v265.sh');
test('V269 actual V207 marriage.numero is the BOLETA number, not a physical partida',()=>{
 for(const sql of [v263,v265]){
  assert.ok(sql.includes("p_sacrament='matrimonio' AND k='numero'"));
  assert.ok(sql.includes("v_raw->>'numero'=coalesce(v_raw->>'numeroRegistro',v_raw->>'numero_registro')"));
  assert.ok(sql.includes("'book_number'"));
  assert.ok(sql.includes("'folio'"));
 }
 assert.ok(q263.includes('numeroRegistro') && q263.includes('Expediente de prueba'));
 assert.ok(q265.includes("'numero','00000003','numeroRegistro','00000003'"));
 assert.match(v263,/p_sacrament='matrimonio'/);
});
test('V269 V263 preserves typed registry fields needed by search and printed official partidas',()=>{
 for(const s of ['fecha_nacimiento,cedula_padre,cedula_madre,fecha_expedicion_registro',
 'hora_sacramento,nota_marginal,observations,raw_data',
 'fecha_nacimiento,fecha_bautismo,nuip,direccion,cedula_padre',
 "v_raw->>'fechaNacimiento'","v_raw->>'cedulaPadre'","v_raw->>'cedulaMadre'",
 "v_raw->>'horaSacramento'","v_raw->>'observations'"]) assert.ok(v263.includes(s),s);
 assert.ok(q263.includes('cedula_padre text'));
 assert.ok(q263.includes('fecha_expedicion_registro date'));
});
test('V269 Baptism-confirmation link uses the real queued new baptism record id',()=>{
 const t=read('scripts/qa-v269-linked-baptism-confirmation-triggers.sql');
 assert.ok(t.includes('sync_linked_confirmation_after_baptism_seat'));
 assert.ok(t.includes('enforce_linked_baptism_before_confirmation_seat'));
 assert.ok(t.includes("'linkedBaptismRecordId',new.id"));
 assert.ok(v263.includes("v_raw->>'linkedBaptismRecordId'"));
 assert.ok(q263.includes('linked Confirmation cannot be seated BEFORE Baptism'));
 assert.ok(q263.includes('linkedBaptismRecordId'));
 assert.ok(q263.includes("SELECT raw_data->>'numeroBautismo'"));
 assert.ok(q263.includes('marginal_notes WHERE sacrament_id'));
});
test('V269 context denies invalid or empty attestations and ignores missing evidence',()=>{
 assert.match(v264,/v_a.verified_at<=clock_timestamp\(\)/);
 assert.match(v264,/v_a.origin IN \('new_sacrament','new_decree_supplement'\)/);
 assert.match(v264,/nullif\(btrim\(coalesce\(v_a.evidence_ref/);
 assert.doesNotMatch(v264,/'verified',FOUND,/);
});
test('V269 the four screens still directly use the same integrated server seat panel',()=>{
 for(const page of ['BaptismSentarRegistrosPage.jsx','ConfirmationSentarRegistrosPage.jsx',
 'MatrimonioSentarRegistrosPage.jsx','FuneralRegistryPage.jsx']){
   const source=read('src/pages/parish/'+page);
   assert.match(source,/LedgerSeatPanelV264/);
   assert.match(source,/ledgerV264Enabled/);
   assert.match(source,/onCompleted/);
 }
 const p=read('src/components/LedgerSeatPanelV264.jsx');
 assert.match(p,/FirstOfficialBookV267/);
 assert.match(p,/verifyCelebration/);
 assert.match(p,/seatWithLedgerV264/);
 const wf=read('.github/workflows/sacramentum-auditoria-v90.yml');
 assert.match(wf,/ci-four-real-seat-rpcs-v263.sh/);
 assert.match(wf,/ci-celebration-attestation-v265.sh/);
 assert.match(read('scripts/audit-gate-v90.mjs'),/test-four-screens-real-integration-v269.mjs/);
});
