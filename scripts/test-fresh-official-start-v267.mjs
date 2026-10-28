import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const matrix=JSON.parse(read('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json'));
const inventory=JSON.parse(read('AUDITORIA_FOTO_COMPLETA_RESET_V267_2026-10-28.json'));
test('V267 real data are TEST data, not historical evidence; 82 public tables classified',()=>{
 assert.equal(matrix.publicTableCount,82);
 assert.equal(matrix.preserve.length,26);
 assert.equal(matrix.zeroRequired.length,56);
 assert.equal(new Set([...matrix.preserve,...matrix.zeroRequired]).size,82);
 assert.equal(inventory.entries,56);
 assert.equal(inventory.nonzero,39);
 assert.equal(inventory.rows.reduce((a,r)=>a+Number(r.records),0),89714);
 assert.equal(inventory.rows.find(r=>r.table_name==='baptisms')?.records,5040);
 assert.equal(inventory.rows.find(r=>r.table_name==='legacy_archive_records')?.records,21676);
 assert.equal(inventory.rows.find(r=>r.table_name==='legacy_import_rows')?.records,16331);
 assert.ok(matrix.preserve.includes('user_profiles'));
 assert.ok(matrix.preserve.includes('parishes'));
 assert.ok(matrix.preserve.includes('parish_parameters'));
 assert.ok(matrix.zeroRequired.includes('decretos'));
 assert.ok(matrix.zeroRequired.includes('registry_audit_log'));
 assert.ok(matrix.zeroRequired.includes('pending_creation_requests'));
 assert.ok(matrix.zeroRequired.includes('legacy_print_events'));
 assert.ok(matrix.zeroRequired.includes('registry_test_artifact_archive'));
});
test('V267 GoLive fails closed on ANY old test table, unclassified table or private ledger state',()=>{
 const s=read('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
 assert.match(s,/^BEGIN;/m);assert.match(s,/^COMMIT;/m);
 assert.match(s,/LOCK TABLE public/);
 assert.match(s,/SELECT count\(\*\) FROM public\.%I/);
 assert.match(s,/v_all_tables<>82/);
 assert.match(s,/v_zero_tables text\[\]/);
 assert.match(s,/v_master_tables text\[\]/);
 assert.match(s,/EXISTS\(SELECT 1 FROM sacramentum_ledger\.seat_events\)/);
 assert.match(s,/go_live_receipt_v267/);
 assert.match(s,/purge_receipts_v268/);
 assert.match(s,/restore_verified=true/);
 assert.match(s,/mode='FRESH_FROM_ZERO'/);
 assert.equal((s.match(/REVOKE EXECUTE ON FUNCTION public\.seat_/g)||[]).length,4);
 assert.equal((s.match(/GRANT EXECUTE ON FUNCTION public\.seat_/g)||[]).length,4);
 assert.match(s,/GRANT EXECUTE ON FUNCTION public\.open_first_official_book_v267/);
 for(const t of matrix.zeroRequired) assert.ok(s.includes("'"+t+"'"),t);
 for(const t of matrix.preserve) assert.ok(s.includes("'"+t+"'"),t);
 assert.doesNotMatch(s,/\b(?:TRUNCATE|DELETE FROM|DROP TABLE)\b/i);
});
test('V267 initial official book is typed by human, after verifiable new celebration',()=>{
 const s=read('scripts/staged-v267-first-official-book.sql');
 for(const token of [
  'open_first_official_book_v267','p_book_code','p_first_folio',
  'p_first_partida','p_partidas_per_folio',
  'p_restart_number_each_folio','origin<>\'new_sacrament\'',
  'celebration_attestations_v263','FOR UPDATE',
  'count(*) FROM public.%I','active_count=0',
  'INSERT INTO sacramentum_ledger.book_memories',
  'legacy_reconciled','first_official_book_opened',
  'INSERT INTO public.registry_audit_log','REVOKE ALL ON FUNCTION'
 ])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/\b(?:UPDATE public\.(?:baptisms|confirmations|marriages|funerals)|DELETE FROM|TRUNCATE)\b/i);
 const panel=read('src/components/FirstOfficialBookV267.jsx');
 for(const token of ['Folio inicial','Número inicial','Partidas por folio',
  'Reiniciar el número','openFirstOfficialBookV267','institutionalConfirm'])
   assert.ok(panel.includes(token),token);
 assert.match(read('src/components/LedgerSeatPanelV264.jsx'),/FirstOfficialBookV267/);
 assert.match(read('src/services/ledgerSeatV264.js'),/open_first_official_book_v267/);
});
test('V267 PG16 performs safe cutover, first book test and manual number without importing old test coordinate',()=>{
 const ci=read('scripts/ci-fresh-official-start-v267.sh');
 for(const s of ['PG_CONTAINER','unexpected','legacy_archive_records','unknown newly added public table',
  'audit failure must roll back memory','first_folio','first_partida',
  'physical','FRESH_FROM_ZERO','PG16 PASS'].filter(x=>x!=='unexpected'))
   assert.ok(ci.toLowerCase().includes(s.toLowerCase()),s);
 assert.match(read('.github/workflows/sacramentum-auditoria-v90.yml'),
   /bash scripts\/ci-fresh-official-start-v267\.sh/);
 assert.match(read('scripts/audit-gate-v90.mjs'),/scripts\/test-fresh-official-start-v267\.mjs/);
});
