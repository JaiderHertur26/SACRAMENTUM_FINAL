import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const report=JSON.parse(fs.readFileSync('AUDITORIA_TRANSACCIONES_LIVE_V228.json','utf8'));
const byFile=new Map(report.scripts.map(x=>[x.file,x]));
const fetchResult=name=>{
 const v=byFile.get('scripts/'+name);
 assert.ok(v,'Missing live SQL evidence '+name);
 return v.metrics?.[0]?.result||v.metrics?.[0]?.results||v.metrics?.[0]?.qa_result||v.metrics?.[0]||{};
};
test('V228 contains 14 genuine, passed, isolated QA transactions, never official',()=>{
 assert.equal(report.protocol,'V228');
 assert.equal(report.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(report.environment,'TEST_QA_NOT_OFFICIAL');
 assert.equal(report.successfulTransactions,14);
 assert.equal(report.transactionChecks,14);
 assert.equal(report.scripts.length,14);
 assert.equal(byFile.size,14);
 assert.equal(report.allRollback,true);
 assert.equal(report.recordsTransferredToOfficial,0);
 assert.equal(report.archivalSamplesOrCredentialsSaved,false);
 assert.match(report.source,/MCP execute_sql/);
});
for(const record of report.scripts){
 test('V228 real QA transaction / sealed SQL source: '+record.file,()=>{
  assert.equal(record.passed,true);
  assert.equal(record.tx_rolled_back,true);
  assert.match(record.file,/^scripts\/qa-rollback-[\w-]+\.sql$/);
  const sql=fs.readFileSync(record.file,'utf8').replace(/\r\n/g,'\n');
  const clean=sql.replace(/^\s*--.*$/gm,'').trim();
  assert.match(clean,/^BEGIN;/);
  assert.match(clean,/ROLLBACK;$/);
  assert.doesNotMatch(clean,/^\s*COMMIT\s*;/mi);
  const sha=createHash('sha256').update(sql).digest('hex');
  assert.equal(record.sql_sha256,sha,'SQL changed since privileged real QA test; rerun the scenario');
  assert.ok(Array.isArray(record.metrics));
 });
}
test('V228 measured before and after the 14 SQL rollbacks: no records remain',()=>{
 const expected={baptisms:5040,confirmations:2091,marriages:1261,funerals:1,
 pending_baptisms:69,pending_confirmations:233,pending_marriages:1,pending_funerals:1,
 decretos:2,marginal_notes:82,print_events:8,audit_entries:353,auth_accounts:12};
 assert.deepEqual(report.countsBefore,expected);
 assert.deepEqual(report.countsAfter,expected);
 assert.deepEqual(report.countsBefore,report.countsAfter);
});
test('V228 new/historical documentary decree is traced but never affects sacrament record',()=>{
 const r=fetchResult('qa-rollback-documentary-decree-lifecycle-v210.sql');
 assert.equal(r.rolled_back,true);
 assert.equal(r.new_documentary,1);
 assert.equal(r.historical_documentary,2);
 assert.equal(r.role_and_validation_denials,4);
 assert.equal(r.cross_diocese_visible,0);
 assert.equal(r.parish_positive_reads,2);
 assert.equal(r.sacramental_counts_unchanged,true);
});
test('V228 four sacraments were seated exactly once with legal audit checks',()=>{
 const r=fetchResult('qa-rollback-four-sacrament-seating-v193.sql');
 assert.equal(r.rollback,true);
 assert.equal(r.sacramental_lifecycles,4);
 assert.equal(r.pendings_closed,4);
 assert.equal(r.duplicate_seating_rejected,4);
 const m=byFile.get('scripts/qa-rollback-four-sacrament-seating-v193.sql').metrics[0];
 assert.ok(m.min_seat_audit_entries>=4);
});
test('V228 four sacramental print receipts validate book, folio, signature and required marginal notes',()=>{
 const r=fetchResult('qa-rollback-print-integrity-v194.sql');
 assert.equal(r.rollback,true);
 assert.equal(r.sacraments_covered,4);
 assert.equal(r.verified_receipts,4);
 assert.equal(r.required_notes_preserved,4);
 assert.equal(r.rejected_invalid_requests,20);
});
test('V228 marginal notes are idempotent and reject cross-parish origin',()=>{
 const r=fetchResult('qa-rollback-marginal-four-sacraments-v216.sql');
 assert.equal(r.rollback,true);
 assert.equal(r.sacraments_passed,4);
 assert.equal(r.owned_notes_created,4);
 assert.equal(r.foreign_source_rejected,4);
 assert.equal(r.same_parish_replays_idempotent,4);
});
test('V228 idempotent pending creation survives retries and disallows changed payload',()=>{
 const r=fetchResult('qa-rollback-idempotent-pending-creation-v207.sql');
 assert.equal(r.circuits,5);
 assert.equal(r.same_receipt_replays,15);
 assert.equal(r.unauthorized_rejected,2);
 assert.equal(r.changed_payload_rejected,5);
 assert.equal(r.direct_ledger_read_denied,true);
});
test('V228 recovered issued receipts without orphan writes and repeated request IDs',()=>{
 const r=fetchResult('qa-rollback-pending-receipt-atomicity-v207.sql');
 assert.equal(r.forced_receipt_failures,4);
 assert.equal(r.recovered_with_same_request_ids,4);
 assert.equal(r.receipts_after_recovery,4);
});
test('V228 marriage and funeral seating increments book sequence correctly',()=>{
 const r=fetchResult('qa-rollback-marriage-funeral-sequential-v202.sql');
 assert.equal(r.rollback,true);
 assert.equal(r.correct_next_folio,true);
 assert.equal(r.unique_sequential_seatings,4);
 assert.equal(r.duplicate_retries_denied,4);
});
test('V228 invalid status and sacrament on a decree do not mutate its source',()=>{
 const r=fetchResult('qa-rollback-decree-status-v189.sql');
 assert.equal(r.rollback_required,true);
 assert.equal(r.fictitious_decrees,1);
 assert.equal(r.invalid_status_denied,1);
 assert.equal(r.invalid_sacrament_denied,1);
 assert.equal(r.original_record_unchanged,true);
});
test('V228 authenticated four-sacrament pending authorization rejects 24 forbidden variants',()=>{
 const s=fs.readFileSync('scripts/qa-rollback-four-pending-authorization-v177.sql','utf8');
 assert.match(s,/count_denied<>24/);
 assert.match(s,/n<>4/);
 assert.match(s,/ROLLBACK;/);
});
test('V228 historical four sacrament workflow and reconciliation cross-entity both executed under rollback',()=>{
 for(const name of ['qa-rollback-historical-four-workflows-v173.sql','qa-rollback-reconciliation-all-sacraments-v159.sql',
 'qa-rollback-notification-archive-active-profile-v171.sql','qa-rollback-chancery-decree-scope-v179.sql',
 'qa-rollback-physical-provenance-legitimate-v121.sql']){
  const r=byFile.get('scripts/'+name);
  assert.equal(r.passed,true);
  assert.equal(r.metrics.length,0,'DO block has no SELECT return; successful execution is evidence only');
 }
});
test('V228 avoids sensitive subject data and does not imply fresh GitHub database access',()=>{
 const raw=JSON.stringify(report);
 assert.doesNotMatch(raw,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 assert.doesNotMatch(raw,/"(?:email|password|access_token|refresh_token|apiKey)"\s*:/i);
 assert.ok(report.claimsNotCovered.some(x=>x.includes('GitHub CI')));
 assert.ok(report.claimsNotCovered.some(x=>x.includes('SMTP')));
});
test('V228 regressions wired to both local master gate and GH Actions',()=>{
 const file='scripts/test-live-transaction-matrix-v228.mjs';
 assert.match(fs.readFileSync('scripts/audit-gate-v90.mjs','utf8'),/scripts\/test-live-transaction-matrix-v228\.mjs/);
 assert.match(fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8'),/scripts\/test-live-transaction-matrix-v228\.mjs/);
 assert.doesNotMatch(fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8'),/run:.*seal-live-transaction-evidence-v228\.mjs/);
});
