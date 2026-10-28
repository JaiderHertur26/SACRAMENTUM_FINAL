import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assertV251RevisedSource} from './v251-reviewed-source-receipt.mjs';
import {LEDGER_SACRAMENTS_V264,ledgerV264Enabled,
  validateLedgerSeatRequestV264,prepareLedgerSeatRequestV264} from '../src/domain/ledgerSeatV264.mjs';
const read=f=>fs.readFileSync(f,'utf8');
const P='00000000-0000-0000-0000-000000000001';
const Q='11111111-1111-1111-1111-111111111111';
const B='22222222-2222-2222-2222-222222222222';
const OP='33333333-3333-3333-3333-333333333333';
const context={parishId:P,sacrament:'bautismo',books:[{id:B,code:'0001A',type:'ordinario',
  version:5,nextFolio:9,nextNumber:40}],boletas:[{id:Q,pending:true,verified:true,
  evidenceRef:'ACTA-AUTORIZADA',bookType:'ordinario'}]};
const base={context,sacrament:'bautismo',parishId:P,pendingIds:[Q],
  bookId:B,manualBookCode:'0001A',manualFolio:'0009',manualNumber:'0040',operationId:OP};
test('V264 selects only a reconciled server book and manual physical coords',()=>{
 const r=validateLedgerSeatRequestV264(base);
 assert.equal(r.name,'seat_baptism_ledger_v263');
 assert.deepEqual(r.payload,{p_parish_id:P,p_book_id:B,p_expected_version:5,
  p_expected_folio:9,p_expected_partida:40,p_operation_id:OP,p_pending_ids:[Q]});
 for(const [key,value] of [['manualFolio','10'],['manualNumber','41'],
   ['manualBookCode','0001'],['parishId','wrong'],['bookId','wrong'],['operationId','wrong']])
   assert.throws(()=>validateLedgerSeatRequestV264({...base,[key]:value}),key);
});
test('V264 cannot seat without authoritative institutional verification',()=>{
 for(const row of [
  {...context.boletas[0],verified:false},{...context.boletas[0],pending:false},
  {...context.boletas[0],evidenceRef:''},
  {...context.boletas[0],bookType:'suplementario'}
 ]) assert.throws(()=>validateLedgerSeatRequestV264({...base,
     context:{...context,boletas:[row]}}));
 assert.throws(()=>validateLedgerSeatRequestV264({...base,pendingIds:[Q,Q]}));
 assert.throws(()=>validateLedgerSeatRequestV264({...base,pendingIds:[]}));
 assert.throws(()=>validateLedgerSeatRequestV264({...base,manualFolio:'0'}));
 assert.throws(()=>validateLedgerSeatRequestV264({...base,manualFolio:'9.5'}));
});
test('V264 four sacramental RPCs are mapped; mode disabled without explicit review cutover',()=>{
 assert.deepEqual(Object.keys(LEDGER_SACRAMENTS_V264).sort(),
 ['bautismo','confirmacion','exequias','matrimonio']);
 assert.equal(ledgerV264Enabled,false);
 assert.throws(()=>prepareLedgerSeatRequestV264(base),/todavía no está activada/);
});
test('V264 four real screens use manual panel and block the old writer in enabled mode',()=>{
 const pages=[
  'BaptismSentarRegistrosPage.jsx','ConfirmationSentarRegistrosPage.jsx',
  'MatrimonioSentarRegistrosPage.jsx','FuneralRegistryPage.jsx'];
 for(const name of pages){
  const s=read('src/pages/parish/'+name);
  assert.match(s,/LedgerSeatPanelV264/);
  assert.match(s,/ledgerV264Enabled/);
  assert.match(s,/if \(ledgerV264Enabled\) return;/);
  assert.match(s,/display:'none'/);
 }
 const s=read('src/components/LedgerSeatPanelV264.jsx');
 for(const field of ['manualBookCode','manualFolio','manualNumber',
  'getLedgerSeatContextV264','seatWithLedgerV264','institutionalConfirm',
  'setLocked(true)','onCompleted']) assert.ok(s.includes(field),field);
 assert.doesNotMatch(s,/save_funeral_parameters|parish_parameters/);
});
test('V264 context SQL never grants a seat and restricts anonymous read',()=>{
 const s=read('scripts/staged-v264-parish-ledger-context.sql');
 assert.match(s,/FUNCTION public.get_parish_ledger_seat_context_v264/);
 assert.match(s,/up.auth_user_id=v_user AND up.parish_id=p_parish_id/);
 assert.match(s,/b.legacy_reconciled=true/);
 assert.match(s,/SELECT a.origin,a.evidence_ref,a.verified_at/);
 assert.match(s,/REVOKE ALL ON FUNCTION public.get_parish_ledger_seat_context_v264/);
 assert.match(s,/TO authenticated/);
 assert.doesNotMatch(s,/GRANT EXECUTE ON FUNCTION public.seat_/);
 const ci=read('scripts/ci-parish-ledger-context-v264.sh');
 assert.match(ci,/missing evidence/i);
 assert.match(ci,/anon/);
 const w=read('.github/workflows/sacramentum-auditoria-v90.yml');
 const gate=read('scripts/audit-gate-v90.mjs');
 assert.match(w,/bash scripts\/ci-parish-ledger-context-v264\.sh/);
 assert.match(gate,/scripts\/test-ledger-ui-cutover-v264\.mjs/);
});

test('V264 source review pins four screens without editing old V205-V207/V251 evidence',()=>{
 const reviewed=JSON.parse(read('AUDITORIA_V264_REVISION_UI_ASIENTOS.json'));
 const predecessor=JSON.parse(read('AUDITORIA_V251_REVISIÓN_SOLO_ETIQUETAS.json'));
 assert.equal(Object.keys(reviewed.reviewedSourceSha256).length,4);
 for(const [file,entry] of Object.entries(reviewed.reviewedSourceSha256)){
   const normalized=read(file).replace(/\r\n/g,'\n');
   assert.equal(createHash('sha256').update(normalized).digest('hex'),entry.after);
   if(predecessor.reviewedSourceSha256[file])
     assert.equal(predecessor.reviewedSourceSha256[file].after,entry.previousSourceSha256);
 }
 assert.deepEqual(reviewed.originalEvidencePreserved,[
  'AUDITORIA_CREACION_BOLETAS_NAVEGADOR_V207.json',
  'AUDITORIA_V251_REVISIÓN_SOLO_ETIQUETAS.json'
 ]);
});

test('V264 accepts freshly regenerated browser evidence and archived reviewed evidence only',()=>{
 const review=JSON.parse(read('AUDITORIA_V264_REVISION_UI_ASIENTOS.json'));
 const old=JSON.parse(read('AUDITORIA_V251_REVISIÓN_SOLO_ETIQUETAS.json'));
 for(const [file,item] of Object.entries(review.reviewedSourceSha256)){
   assert.doesNotThrow(()=>assertV251RevisedSource({
     file,historicalSha256:item.after,currentSha256:item.after
   }));
   const previous=old.reviewedSourceSha256[file]?.before||item.previousSourceSha256;
   assert.doesNotThrow(()=>assertV251RevisedSource({
     file,historicalSha256:previous,currentSha256:item.after
   }));
   assert.throws(()=>assertV251RevisedSource({
     file,historicalSha256:'0'.repeat(64),currentSha256:item.after
   }));
   assert.throws(()=>assertV251RevisedSource({
     file,historicalSha256:previous,currentSha256:'f'.repeat(64)
   }));
 }
});
