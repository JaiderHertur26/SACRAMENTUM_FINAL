import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const sql=read('scripts/staged-v272-next-supplementary-book.sql');
const policy=read('scripts/staged-v272-authorize-supplementary-concept.sql');
const issue=read('scripts/staged-v271-two-role-new-supplement-decrees.sql');
const ci=read('scripts/ci-four-real-seat-rpcs-v263.sh');
test('V272 successor is supplementary-only and requires new active independently approved decree',()=>{
 for(const s of [
 'open_next_supplementary_book_v272',
 "v_old.book_type<>'suplementario'",
 "v_attestation.origin<>'new_decree_supplement'",
 "v_attestation.decree_effect<>'create_supplementary_record'",
 "v_decree.status<>'active'",
 "v_decree.payload->>'diocesanApprovedBy'",
 "v_decree.payload->>'recordOrigin'<>'new_decree_supplement_v271'",
 "v_decree.payload->>'pendingId'<>p_pending_id::text",
 "v_decree.issued_by::text=v_decree.payload->>'diocesanApprovedBy'",
 "AND p.book_type=''suplementario''",
 'predecessor_book_id',
 "predecessor_book_id=v_old.id",
 "v_previous_seat.sacramental_record_id",
 "v_old.active_count<1",
 "p_sacrament||':suplementario:first',271",
 "v_old.version<>p_expected_version",
 "v_existing.active_count<>0",
 "closed_at=v_closed",
 "REVOKE ALL ON FUNCTION"
 ])assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/DELETE FROM public\.|TRUNCATE TABLE|DISABLE TRIGGER/);
});
test('V272 Diocese explicitly authorizes a specific existing manual concept; no fabricated policy',()=>{
 for(const s of [
 "supplementary_concept_approvals_v272",
 "ENABLE ROW LEVEL SECURITY",
 "REVOKE ALL",
 "lower(up.role)='diocese'",
 "lower(coalesce(v_concept.source_kind,''))<>'manual'",
 "v_concept.sacrament_type NOT IN('bautismo','confirmacion','matrimonio','exequias')",
 "v_concept.enlibro<>2",
 "lower(coalesce(v_concept.tipo,''))<>'porreposicion'",
 "v_concept.seinscribe IS DISTINCT FROM TRUE",
 "v_existing.policy_snapshot<>v_snapshot",
 "authorization_reference",
 "approve_supplementary_concept_v272",
 "INSERT INTO public.registry_audit_log"
 ])assert.ok(policy.includes(s),s);
 assert.doesNotMatch(policy,/INSERT INTO public\.conceptos_anulacion|UPDATE public\.conceptos_anulacion/);
});
test('V271 issuer now requires a policy snapshot signed by Diocesan authority and locks concept',()=>{
 for(const s of [
 "supplementary_concept_approvals_v272",
 "a.policy_snapshot=jsonb_build_object(",
 "a.approved_by IS NOT NULL",
 "V272: el concepto no tiene autorización diocesana vigente",
 "c.is_active IS TRUE FOR SHARE"
 ])assert.ok(issue.includes(s),s);
});
test('V272 interface shares four-sacrament seat panel, one source of truth, separate Diocese role',()=>{
 assert.match(read('src/services/ledgerSeatV264.js'),/open_next_supplementary_book_v272/);
 assert.match(read('src/components/NextOfficialBookV270.jsx'),/openNextSupplementaryBookV272/);
 assert.match(read('src/components/LedgerSeatPanelV264.jsx'),/bookType=\{type\}/);
 const ui=read('src/components/chancery/DiocesanSupplementaryConceptApprovalV272.jsx');
 assert.match(ui,/approve_supplementary_concept_v272/);
 assert.match(ui,/institutionalConfirm/);
 assert.match(read('src/pages/diocese/DiocesanDecreeOversightPage.jsx'),/DiocesanSupplementaryConceptApprovalV272/);
 const cut=read('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
 for(const name of ['approve_supplementary_concept_v272','open_next_supplementary_book_v272']) {
  assert.match(cut,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+name));
  assert.ok(read('scripts/ci-fresh-official-start-v267.sh').includes(name));
 }
});
test('V272 PG16 actually checks unauthorized concept, unauthorized successor, second decree and closed book',()=>{
 for(const s of [
 'chancery cannot authorize concept',
 'parish cannot authorize concept',
 'chancery cannot issue without approved policy',
 'no second decree cannot move supplementary book',
 'issued but unapproved decree cannot close book',
 'stale expected version rejects successor',
 'closed supplementary book must reject seat',
 'concept authorization fingerprint drift',
 'V272 PG16 PASS'
 ])assert.ok(ci.includes(s),s);
 assert.ok(read('.github/workflows/sacramentum-auditoria-v90.yml').includes('test-supplementary-succession-v272.mjs'));
});
