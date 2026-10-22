import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const v144=read('supabase/migrations/20261022182523_lock_registry_print_and_track_request_lineage_v144.sql');
const v145=read('supabase/migrations/20261022182724_sort_print_request_lineage_by_sequence_v145.sql');
const v146=read('supabase/migrations/20261022183433_guard_malformed_legacy_print_sequence_v146.sql');
const qa4=read('scripts/qa-rollback-print-request-lineage-v144.sql');
const qaLegacy=read('scripts/qa-rollback-historical-print-lineage-v145.sql');
const qaBroken=read('scripts/qa-rollback-malformed-legacy-print-baseline-v146.sql');
const qaFixed=read('scripts/qa-rollback-malformed-historical-lineage-postfix-v146.sql');
const qaV143=read('scripts/qa-rollback-print-optimistic-coordinates-v143.sql');
const fn=ddl=>ddl.slice(ddl.indexOf('CREATE OR REPLACE FUNCTION public.register_registry_print('));

test('V144-V146 preserve the exact RPC signature, rights and caller scope',()=>{
 for(const ddl of [v144,v145,v146]){
  assert.match(ddl,/CREATE OR REPLACE FUNCTION public.register_registry_print\(/);
  assert.match(ddl,/SECURITY DEFINER/);
  assert.match(ddl,/SET search_path TO 'public'/);
  assert.match(ddl,/if auth.uid\(\) is null/);
  assert.match(ddl,/not public.can_access_parish\(p_parish_id\)/);
 }
});
test('V144 holds a lock on the exact baptism row until transaction ends',()=>{
 assert.match(v146,/from public.baptisms\s+where id=p_sacrament_id and parish_id=p_parish_id\s+for share;/);
});
test('V144 holds a lock on the exact confirmation row',()=>{
 assert.match(v146,/from public.confirmations\s+where id=p_sacrament_id and parish_id=p_parish_id\s+for share;/);
});
test('V144 holds a lock on the exact marriage row',()=>{
 assert.match(v146,/from public.marriages\s+where id=p_sacrament_id and parish_id=p_parish_id\s+for share;/);
});
test('V144 holds a lock on the exact funeral row',()=>{
 assert.match(v146,/from public.funerals\s+where id=p_sacrament_id and parish_id=p_parish_id\s+for share;/);
});
test('V144 transaction advisory lock uniquely groups a parish sacrament record and document kind',()=>{
 assert.match(v146,/pg_advisory_xact_lock\(/);
 assert.match(v146,/hashtext\('registry_print_request:'\|\|p_parish_id::text\)/);
 assert.match(v146,/hashtext\(v_type\|\|':'\|\|p_sacrament_id::text\|\|':'\|\|v_document_kind\)/);
});
test('V144 counts previous requests with same parish, sacrament, record and document',()=>{
 assert.match(v146,/select count\(\*\)::integer\+1 into v_request_sequence/);
 assert.match(v146,/pe.parish_id=p_parish_id and pe.sacrament_type=v_type/);
 assert.match(v146,/pe.sacrament_id=p_sacrament_id and pe.document_kind=v_document_kind/);
});
test('V144 calls previous request a request, not proof of a paper print',()=>{
 assert.match(v146,/'print_request_sequence',v_request_sequence/);
 assert.match(v146,/'previous_print_request_id',v_previous_print_id/);
 assert.match(v146,/'print_request_classification'/);
 assert.match(v146,/'primera_solicitud'/);
 assert.match(v146,/'reimpresion_solicitada'/);
});
test('V144 server-authored request lineage cannot be overwritten by client supplied metadata',()=>{
 const position=v146.indexOf("v_metadata:=coalesce(p_metadata,'{}'::jsonb)");
 const server=v146.indexOf("'print_request_sequence',v_request_sequence",position);
 const saved=v146.indexOf('insert into public.registry_print_events',position);
 assert.ok(position>=0&&server>position&&saved>server);
});
test('V145 sorts requests by sequence before timestamp to handle identical now()',()=>{
 const start=v145.indexOf('select pe.id into v_previous_print_id');
 const end=v145.indexOf('v_metadata:=coalesce',start);
 const section=v145.slice(start,end);
 assert.match(section,/print_request_sequence'\)::integer,0\) desc/);
 assert.ok(section.indexOf('print_request_sequence')<section.indexOf('pe.requested_at desc'));
});
test('V146 treats malformed, missing and oversized legacy sequence as zero instead of throwing',()=>{
 const start=v146.indexOf('select pe.id into v_previous_print_id');
 const end=v146.indexOf('v_metadata:=coalesce',start);
 const section=v146.slice(start,end);
 assert.match(section,/order by case/);
 assert.match(section,/print_request_sequence' ~ '\^\[0-9\]\{1,9\}\$'/);
 assert.match(section,/else 0 end desc/);
 assert.doesNotMatch(section,/order by coalesce\(\(pe.metadata->>'print_request_sequence'\)::integer/);
});
test('V144 four sacraments produce sequences 1,2,3 and independent first constancia',()=>{
 for(const sacrament of ['bautismo','confirmacion','matrimonio','exequias'])assert.ok(qa4.includes("'"+sacrament+"'"));
 for(const field of ["v_first::text","v_second::text","v_one.metadata->>'print_request_sequence'<>'1'",
  "v_two.metadata->>'print_request_sequence'<>'2'","v_three.metadata->>'print_request_sequence'<>'3'",
  "v_alt.metadata->>'print_request_sequence'<>'1'"])assert.ok(qa4.includes(field),field);
});
test('V145 fake historical event remains unmodified as first subsequent request becomes reprint',()=>{
 assert.match(qaLegacy,/v_a.metadata->>'print_request_sequence'<>'2'/);
 assert.match(qaLegacy,/v_b.metadata->>'print_request_sequence'<>'3'/);
 assert.match(qaLegacy,/v_a.metadata->>'previous_print_request_id'<>v_legacy::text/);
 assert.match(qaLegacy,/v_b.metadata->>'previous_print_request_id'<>v_copy1::text/);
});
test('V146 baseline contains malformed sequence that formerly failed conversion',()=>{
 assert.match(qaBroken,/NO_NUMERIC/);
 assert.match(qaBroken,/V146-BASELINE-UNEXPECTED/);
});
test('V146 post-fix proves both nonnumeric and huge integer historical metadata preserved',()=>{
 assert.match(qaFixed,/NO_NUMERIC/);
 assert.match(qaFixed,/9999999999999999999999999/);
 assert.match(qaFixed,/v_a.metadata->>'previous_print_request_id'<>v_legacy_bad::text/);
 assert.match(qaFixed,/v_b.metadata->>'previous_print_request_id'<>v_legacy_big::text/);
});
test('V143 authorization/version/coordinates security checks survive reprint migrations',()=>{
 for(const check of [
  "v_expected_coordinates->>'book'","v_expected_coordinates->>'folio'",
  "v_expected_coordinates->>'number'","v_record_updated_at is distinct from",
  "v_client_html_hash !~ '^[0-9a-f]{64}$'"
 ])assert.ok(v146.includes(check),check);
 assert.match(qaV143,/v_passed<>4 OR v_denied<>24 OR v_legacy<>4/);
});
test('V144-146 all migrations contain exactly one complete function, not accidental SQL trailers',()=>{
 for(const sql of [v144,v145,v146]){
  assert.equal(sql.split('$function$').length-1,2);
  assert.match(sql,/^\$function\$;\s*$/m);
  assert.ok(sql.trim().endsWith('$function$;'));
 }
});
for(const [name,sql] of [['lineage',qa4],['historical',qaLegacy],['malformed_baseline',qaBroken],['malformed_fixed',qaFixed]]){
 test('SQL '+name+' uses full transaction and final ROLLBACK without commit',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
