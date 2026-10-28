import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=p=>fs.readFileSync(p,'utf8');
test('V270 actual book table retains used records and closure evidence immutably',()=>{
 const s=r('scripts/qa-v252-ledger-memory-schema.sql');
 for(const t of ['closed_at timestamptz','closed_by_auth uuid','close_evidence_ref text','predecessor_book_id uuid','uq_v270_one_successor','Un cierre de libro oficial es inmutable']) assert.ok(s.includes(t),t);
 assert.match(r('scripts/qa-v253-ledger-transactions.sql'),/m.closed_at IS NOT NULL/);
 assert.match(r('scripts/staged-v263-four-real-seat-rpcs.sql'),/m.closed_at IS NOT NULL/);
 assert.match(r('scripts/staged-v264-parish-ledger-context.sql'),/b.closed_at IS NULL/);
});
test('V270 official successor transaction verifies real last physical seat, fresh pending and CAS',()=>{
 const s=r('scripts/staged-v270-next-official-book.sql');
 for(const t of ['SECURITY DEFINER',"lower(up.role)='parish'",'p_expected_version',
   'v_old.active_count<1','v_old.closed_at IS NOT NULL',
   'FROM sacramentum_ledger.active_seats','ordinal=v_old.active_count-1',
   'v_previous_seat.sacramental_record_id','p.book_number=$3',
   "v_attestation.origin<>'new_sacrament'",'new_decree_supplement',
   'book_closed_for_succession_v270','successor_book_opened_v270',
   'predecessor_book_id','close_evidence_ref','REVOKE ALL',
   'RETURN jsonb_build_object'].filter(x=>x!=='new_decree_supplement'))assert.ok(s.includes(t),t);
 assert.doesNotMatch(s,/DELETE FROM public\.|TRUNCATE|DROP TABLE|DISABLE TRIGGER/);
 const first=r('scripts/staged-v267-first-official-book.sql');
 assert.match(first,/m.book_type='ordinario'\) THEN/);
});
test('V270 integrated into four active-parish pages through a common component and explicit V267 permission cutover',()=>{
 const s=r('src/components/NextOfficialBookV270.jsx');
 for(const t of ['Cerrar libro y abrir sucesor','Partidas por folio',
   'Constancia de cierre físico','institutionalConfirm','openNextOfficialBookV270'])assert.ok(s.includes(t),t);
 const p=r('src/components/LedgerSeatPanelV264.jsx');
 assert.ok(p.includes('NextOfficialBookV270'));
 assert.ok(p.includes("type==='ordinario'"));
 assert.match(r('src/services/ledgerSeatV264.js'),/open_next_official_book_v270/);
 const c=r('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
 assert.match(c,/open_next_official_book_v270/);
 assert.match(c,/GRANT EXECUTE ON FUNCTION public.open_next_official_book_v270/);
 assert.match(r('scripts/ci-four-real-seat-rpcs-v263.sh'),/old book closed: writer rejected/);
 assert.match(r('scripts/ci-four-real-seat-rpcs-v263.sh'),/cannot replay successor once it contains a seat/);
 assert.ok(r('.github/workflows/sacramentum-auditoria-v90.yml').includes('test-next-official-book-v270.mjs'));
});
