import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// These are offline contracts. The live SQL is deliberately NOT run in CI.
const files = {
  seating: 'scripts/qa-rollback-four-sacrament-seating-v193.sql',
  documentary: 'scripts/qa-rollback-documentary-decree-lifecycle-v210.sql',
  repos: 'scripts/qa-rollback-repositions-v210.sql',
  corrections: 'scripts/qa-rollback-corrections-reconciliation-all-sacraments-v159.sql'
};
const read = name => fs.readFileSync(files[name], 'utf8');
const expected = (name, values) => {
  const source=read(name);
  for (const token of values) assert.ok(source.includes(token), name+': missing '+token);
};
for (const name of Object.keys(files)) {
  test('V210 '+name+' is an explicitly reversible transaction',()=>{
    const s=read(name);
    assert.match(s,/^BEGIN;$/m);
    assert.match(s,/^ROLLBACK;\s*$/m);
    assert.doesNotMatch(s,/^\s*COMMIT\s*;/im);
    assert.doesNotMatch(s,/\bdblink_exec\s*\(/i);
    assert.doesNotMatch(s,/\bpg_notify\s*\(/i);
  });
}
test('V210 keeps all four sacramental boleta-to-seat workflows',()=>{
  expected('seating',[
    'create_pending_baptism','seat_baptism_records',
    'create_pending_confirmation','seat_confirmation_records',
    'create_pending_marriage','seat_pending_marriage',
    'create_pending_funeral','seat_funeral_record',
    'duplicate_seating_rejected','registry_audit_log'
  ]);
});
test('V210 corrections cover four sacraments and restored originals',()=>{
  expected('corrections',[
    "'bautismo','confirmacion','matrimonio','exequias'",
    'apply_baptism_correction','apply_confirmation_correction',
    'apply_marriage_correction','apply_funeral_correction',
    'request_later_note_reconciliation_v156',
    'approve_later_note_reconciliation_v156',
    'execute_later_note_reconciliation_v156',
    "v_checked<>4", "v_count<>3", "decree_reconciliation"
  ]);
});
test('V210 documentary scope uses a single matched Chancery/Diocese',()=>{
  expected('documentary',[
    "current_setting('qa.chancery_uid')",
    "ch.auth_user_id::text=current_setting('qa.chancery_uid')",
    "u.diocese_id=ch.diocese_id",
    "p.diocese_id=ch.diocese_id",
    'v_operational','v_historical'
  ]);
});
test('V210 documentary workflow separates current and historical acts',()=>{
  expected('documentary',[
    "issue_documentary_decree_v88(v_operational,'bautismo'",
    "issue_documentary_decree_v88(v_operational,'matrimonio'",
    "issue_documentary_decree_v88(v_historical,'exequias'",
    "'historical'","'sourceReference'","'affectsSacramentalRecord'",
    'get_decree_trace_v89','v_before IS DISTINCT FROM v_after'
  ]);
});
test('V210 documentary RLS verifies own parish and foreign diocese',()=>{
  expected('documentary',[
    "current_setting('qa210.parish_uid')",
    "current_setting('qa210.foreign_uid')",
    "v_own_visible<>2",
    "v_foreign_visible<>0",
    "'cross_diocese_visible',v_foreign_visible",
    "v_denied<>4",
    "'rolled_back',true"
  ]);
});
test('V210 repositions require linked effects and allow only Chancery reversal',()=>{
  expected('repos',[
    "parish_id=v_parish", "create_marriage_reposition_by_decree",
    "create_funeral_reposition_by_decree",
    "reverse_marriage_decree", "reverse_funeral_decree",
    "se autorizó reversión parroquial",
    "se autorizó reversión diocesana",
    "v_count<>2",
    "'unauthorized_reversals_denied',v_count*2"
  ]);
});
test('V210 cannot be treated as a CI live database mutation',()=>{
  const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
  for (const sqlFile of ['qa-rollback-documentary-decree-lifecycle-v210.sql','qa-rollback-repositions-v210.sql']) {
    assert.doesNotMatch(workflow,new RegExp('execute_sql[^\\n]*'+sqlFile));
  }
});
