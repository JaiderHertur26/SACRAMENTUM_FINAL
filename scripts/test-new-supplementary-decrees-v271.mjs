import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const issue=read('scripts/staged-v271-two-role-new-supplement-decrees.sql');
const first=read('scripts/staged-v271-first-supplementary-book.sql');
const ci=read('scripts/ci-four-real-seat-rpcs-v263.sh');
test('V271 new decrees require authentic V207 boleta and an approved supplementary concept',()=>{
 for(const s of [
  "lower(up.role)='chancery'","p.is_operational IS TRUE",
  "v_concept.seinscribe IS DISTINCT FROM TRUE","v_concept.enlibro IS DISTINCT FROM 2",
  "'porreposicion','reposicion'","pending_creation_requests",
  "c.response->>'confirmation_pending_id'","p_pending_id",
  "'pending_diocesan_review'","originalRecordId',null",
  "'replacementRecordId',null","'create_supplementary_record'",
  "v_date>current_date","historic|legacy|import"
 ])assert.ok(issue.includes(s),s);
 assert.match(issue,/chk_decretos_status CHECK/);
 assert.doesNotMatch(issue, /INSERT INTO public\.(baptisms|confirmations|marriages|funerals)/);
});
test('V271 independent diocese approval is required before V263 supplementary evidence',()=>{
 for(const s of [
  "lower(up.role)='diocese'","v_decree.issued_by=v_actor",
  "v_decree.status<>'pending_diocesan_review'",
  "v_decree.payload->>'recordOrigin'<>'new_decree_supplement_v271'",
  "v_decree.payload->>'decreeEffect'<>'create_supplementary_record'",
  "v_decree.payload->>'documentaryOnly'<>'false'",
  "celebration_attestations_v263",
  "'new_decree_supplement'","'create_supplementary_record'",
  "v_decree.payload->>'diocesanReviewRef'",
  "approve_new_supplementary_decree_v271",
  "REVOKE ALL ON FUNCTION public.approve_new_supplementary_decree_v271"
 ])assert.ok(issue.includes(s),s);
 assert.doesNotMatch(issue, /DELETE FROM public\.|TRUNCATE/);
});
test('V271 first supplementary book requires approved decree and physical coordinates',()=>{
 for(const s of [
  "open_first_supplementary_book_v271",
  "lower(up.role)='parish'",
  "v_att.origin<>'new_decree_supplement'",
  "v_decree.status<>'active'",
  "v_decree.payload->>'diocesanApprovedBy'",
  "'suplementario'",
  "v_att.decree_effect<>'create_supplementary_record'",
  "p_first_folio","p_first_partida","p_book_code",
  "first_supplementary_book_opened_v271",
  "REVOKE ALL ON FUNCTION"
 ])assert.ok(first.includes(s),s);
 assert.doesNotMatch(first,/DELETE FROM public\.|TRUNCATE/);
});
test('V271 UI and 3 permissions only on verified cutover, with 3-role PostgreSQL drill',()=>{
 const c=read('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
 for(const s of [
  'issue_new_supplementary_decree_v271',
  'approve_new_supplementary_decree_v271',
  'open_first_supplementary_book_v271'
 ]){assert.ok(c.includes(s),s);assert.ok(ci.includes(s),s);}
 assert.ok(read('src/components/LedgerSeatPanelV264.jsx').includes('bookType="suplementario"'));
 assert.ok(read('src/components/FirstOfficialBookV267.jsx').includes('openFirstSupplementaryBookV271'));
 assert.ok(read('src/components/chancery/NewSupplementaryDecreePanelV271.jsx').includes('issue_new_supplementary_decree_v271'));
 assert.ok(read('src/components/chancery/NewSupplementaryDecreePanelV271.jsx').includes('approve_new_supplementary_decree_v271'));
 assert.ok(read('src/pages/chancery/SacramentalDecreesCenterPage.jsx').includes('NewSupplementaryDecreePanelV271'));
 assert.ok(read('src/pages/diocese/DiocesanDecreeOversightPage.jsx').includes('NewSupplementaryDecreePanelV271'));
 for(const s of ['same issuer cannot approve','cannot open supplementary before diocese approval',
   'book_type=\'suplementario\'','raw_data->>\'numeroRegistro\''])assert.ok(ci.includes(s),s);
 assert.ok(read('.github/workflows/sacramentum-auditoria-v90.yml').includes('test-new-supplementary-decrees-v271.mjs'));
});
