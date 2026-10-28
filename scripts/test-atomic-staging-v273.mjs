import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
test('V273 staged SECURITY DEFINER RPC registrations are atomic, including REVOKE and audit state',()=>{
 const files=[
 'staged-v263-four-real-seat-rpcs.sql','staged-v264-parish-ledger-context.sql',
 'staged-v265-attest-new-celebration.sql','staged-v266-two-signature-physical-review.sql',
 'staged-v267-first-official-book.sql','staged-v270-next-official-book.sql',
 'staged-v271-two-role-new-supplement-decrees.sql','staged-v271-first-supplementary-book.sql',
 'staged-v272-authorize-supplementary-concept.sql','staged-v272-next-supplementary-book.sql',
 'staged-v273-institutional-master-review.sql'
 ];
 for(const f of files){
  const s=read('scripts/'+f).trim();
  assert.ok(s.startsWith('BEGIN;'),f+' begin');
  assert.ok(s.endsWith('COMMIT;'),f+' commit');
  assert.match(s,/REVOKE ALL/,f);
 }
 const context=read('scripts/staged-v264-parish-ledger-context.sql');
 const attest=read('scripts/staged-v265-attest-new-celebration.sql');
 assert.match(context,/FROM PUBLIC,anon,authenticated/);
 assert.match(attest,/FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(context,/GRANT EXECUTE ON FUNCTION/);
 assert.doesNotMatch(attest,/GRANT EXECUTE ON FUNCTION/);
});
test('V273 only the coordinated fresh-go-live V267 cutover exposes context and attestation authenticated RPCs',()=>{
 const s=read('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
 assert.match(s,/GRANT EXECUTE ON FUNCTION public.get_parish_ledger_seat_context_v264/);
 assert.match(s,/GRANT EXECUTE ON FUNCTION public.attest_new_celebration_v265/);
 assert.ok(s.includes('sacramentum_ledger.master_review_v273'));
 assert.ok(s.includes('auth.users'));
 const pg=read('scripts/ci-fresh-official-start-v267.sh');
 assert.match(pg,/fixture-master-review-v273.mjs/);
 assert.ok(pg.includes("'public.get_parish_ledger_seat_context_v264(uuid,text,jsonb)','EXECUTE')\")\" f"));
 assert.ok(pg.includes("'public.attest_new_celebration_v265(uuid,text,uuid,text)','EXECUTE')\")\" t"));
});
