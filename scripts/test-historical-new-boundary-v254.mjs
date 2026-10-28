import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ENTRY_PATH,resolveRegistryJourney,historicalCoordinates,
  validateHistoricalDecreeAssociation} from '../src/domain/registryJourneyPolicy.mjs';
const uuid=n=>('00000000-0000-0000-0000-'+String(n).padStart(12,'0'));
const refs={Libro:'0001A',folio:'0005',numero:'0012'};
const newRecord={nombres:'Persona ficticia'};
const parish=uuid(77);
const historicalContext={sourceVerified:true,mappedParishId:parish,sacrament:'bautismo',decreeReference:'DECRETO-0001'};
const candidate=(n,coordinates=refs,overrides={})=>({id:uuid(n),parishId:parish,sacrament:'bautismo',...coordinates,...overrides});
test('V254 a newly celebrated sacrament pending seating consumes book memory only after confirmation',()=>{
 assert.deepEqual(resolveRegistryJourney({path:ENTRY_PATH.NEW_SACRAMENT,verified:true,record:newRecord}),
  {path:'new_sacrament',action:'seat_new',consumeMemory:true,preservePhysicalCoordinates:false});
 assert.throws(()=>resolveRegistryJourney({path:ENTRY_PATH.NEW_SACRAMENT,verified:false,record:newRecord}),/verificada/);
});
test('V254 a historical sacrament already has its exact book, folio and number',()=>{
 for(const kind of [ENTRY_PATH.HISTORICAL_DIRECT,ENTRY_PATH.HISTORICAL_IMPORT]){
  const p=resolveRegistryJourney({path:kind,record:refs});
  assert.equal(p.consumeMemory,false);
  assert.equal(p.action,'preserve_historical');
  assert.deepEqual(p.coordinates,{book:'0001A',folio:'0005',number:'0012'});
 }
 assert.equal(historicalCoordinates({book_number:'0001A',page_number:'0005',entry_number:'0012'}).book,'0001A');
});
test('V254 no historical record may be silently passed through new seating even when celebration is verified',()=>{
 assert.throws(()=>resolveRegistryJourney({path:ENTRY_PATH.NEW_SACRAMENT,verified:true,record:refs}),/partida nueva/);
 assert.throws(()=>resolveRegistryJourney({path:ENTRY_PATH.NEW_DECREE_SUPPLEMENT,verified:true,
  decreeEffect:'create_supplementary_record',record:refs}),/partida nueva/);
});
test('V254 no duplicate registry when a new pending already has an existing record',()=>{
 assert.throws(()=>resolveRegistryJourney({path:ENTRY_PATH.NEW_SACRAMENT,verified:true,
  record:newRecord,linkedRecordIds:[uuid(10)]}),/Ya existe/);
});
test('V254 new supplementary decree may seat; a documentary or correcting decree on an existing record may not',()=>{
 const supplement=resolveRegistryJourney({path:ENTRY_PATH.NEW_DECREE_SUPPLEMENT,
  verified:true,record:newRecord,decreeEffect:'create_supplementary_record'});
 assert.equal(supplement.consumeMemory,true);
 assert.throws(()=>resolveRegistryJourney({path:ENTRY_PATH.NEW_DECREE_SUPPLEMENT,
  verified:true,record:newRecord,decreeEffect:'correction'}));
 const correction=resolveRegistryJourney({path:ENTRY_PATH.NEW_DECREE_EXISTING,
  linkedRecordIds:[uuid(5)]});
 assert.equal(correction.consumeMemory,false);
 assert.equal(correction.recordId,uuid(5));
});
test('V255 historical decree association requires a verified, scoped existing partida',()=>{
 const ok=validateHistoricalDecreeAssociation({...historicalContext,
  originalCoordinates:refs,originalMatches:[candidate(4)]});
 assert.equal(ok.action,'link_existing_decree');
 assert.equal(ok.consumeMemory,false);
 assert.equal(ok.originalRecordId,uuid(4));
 assert.equal(ok.replacementRecordId,null);
 for(const matches of [[],[candidate(3),candidate(4)],['nonsense'],[uuid(4)]]){
  const r=validateHistoricalDecreeAssociation({...historicalContext,originalCoordinates:refs,originalMatches:matches});
  assert.equal(r.action,'review_required');
  assert.equal(r.consumeMemory,false);
 }
});
test('V255 historical supplementary partida must already exist, match context and be unique',()=>{
 const replacement={Libro:'0011',folio:'0009',numero:'0013'};
 const linked=validateHistoricalDecreeAssociation({...historicalContext,
  originalCoordinates:refs,replacementCoordinates:replacement,
  originalMatches:[candidate(1)],replacementMatches:[candidate(2,replacement)]});
 assert.equal(linked.action,'link_existing_decree');
 assert.equal(linked.replacementRecordId,uuid(2));
 assert.deepEqual(linked.replacementCoordinates,{book:'0011',folio:'0009',number:'0013'});
 for(const results of [[],[candidate(2,replacement),candidate(3,replacement)],[candidate(1,replacement)]]){
  const x=validateHistoricalDecreeAssociation({...historicalContext,
   originalCoordinates:refs,replacementCoordinates:replacement,
   originalMatches:[candidate(1)],replacementMatches:results});
  assert.equal(x.consumeMemory,false);
  assert.equal(x.action,'review_required');
 }
});
test('V254 historical records require their documented coordinates and reject contradictions',()=>{
 for(const missing of [{Libro:'0001',folio:'1'},{Libro:'0001',numero:'2'},{folio:'1',numero:'2'}])
  assert.throws(()=>historicalCoordinates(missing),/Libro, Folio y Número/);
 assert.throws(()=>historicalCoordinates({...refs,book_number:'0002'}),/contradictorias/);
 assert.throws(()=>resolveRegistryJourney({path:'unknown'}),/procedencia/);
});
test('V255 historic decree route is fail-closed without a verified source and one UUID match',()=>{
 for(const options of [{record:refs,linkedRecordIds:[]},{record:refs,linkedRecordIds:[uuid(5)]},
   {verified:true,record:refs,linkedRecordIds:['not-uuid']}]){
  const plan=resolveRegistryJourney({path:ENTRY_PATH.HISTORICAL_DECREE,...options});
  assert.equal(plan.action,'review_required');
  assert.equal(plan.consumeMemory,false);
 }
 const linked=resolveRegistryJourney({path:ENTRY_PATH.HISTORICAL_DECREE,
  verified:true,record:refs,linkedRecordIds:[uuid(5)]});
 assert.equal(linked.action,'link_existing_decree');
 assert.equal(linked.consumeMemory,false);
});
test('V255 cannot automatically link a historical decree with wrong provenance or coordinates',()=>{
 const options={...historicalContext,originalCoordinates:refs,originalMatches:[candidate(4)]};
 for(const [change,reason] of [
  [{sourceVerified:false},'origin_not_verified'],
  [{mappedParishId:undefined},'origin_not_verified'],
  [{sacrament:'undefined'},'sacrament_not_verified'],
  [{decreeReference:'  '},'missing_historical_decree_reference'],
  [{originalMatches:[candidate(4,refs,{parishId:uuid(55)})]},'original_outside_scope'],
  [{originalMatches:[candidate(4,refs,{sacrament:'confirmacion'})]},'original_outside_scope'],
  [{originalMatches:[candidate(4,{Libro:'0009',folio:'0005',numero:'0012'})]},'original_coordinates_mismatch']
 ]){
  const actual=validateHistoricalDecreeAssociation({...options,...change});
  assert.equal(actual.action,'review_required');
  assert.equal(actual.reason,reason);
  assert.equal(actual.consumeMemory,false);
 }
 const replacement={Libro:'0011',folio:'0009',numero:'0013'};
 for(const [match,reason] of [
  [candidate(3,replacement,{parishId:uuid(55)}),'replacement_outside_scope'],
  [candidate(3,{...replacement,numero:'0999'}),'replacement_coordinates_mismatch']
 ]){
  const actual=validateHistoricalDecreeAssociation({...options,replacementCoordinates:replacement,replacementMatches:[match]});
  assert.equal(actual.reason,reason);
 }
 const ok=validateHistoricalDecreeAssociation({...options,
  originalMatches:[candidate(4,{Libro:'0001A',folio:'5',numero:'12'})]});
 assert.equal(ok.action,'link_existing_decree');
 assert.deepEqual(ok.originalCoordinates,{book:'0001A',folio:'0005',number:'0012'});
});
test('V254 actual historical service preserves separate direct historical RPCs, never invokes new book memory',()=>{
 const src=fs.readFileSync('src/services/historicalRegistryService.js','utf8');
 for(const fn of ['register_historical_baptism','register_historical_confirmation',
 'register_historical_marriage','register_historical_narrative'])
  assert.match(src,new RegExp(fn));
 assert.match(src,/historicalCoordinates\(formData\)/);
 assert.match(src,/historicalCoordinates\(record\)/);
 assert.doesNotMatch(src,/qa_append_batch|seat_baptism_records|seat_confirmation_records/);
});
test('V254 import of historical decrees keeps source and links, no automatic new asiento',()=>{
 const src=fs.readFileSync('src/services/legacyDecreeReconciliationService.js','utf8');
 const ui=fs.readFileSync('src/components/chancery/HistoricalDecreeReconciliationPanel.jsx','utf8');
 assert.match(src,/materialize_legacy_decrees_v68/);
 assert.match(src,/linkedOriginalRecordId/);
 assert.match(src,/requiresLinkReview/);
 assert.match(ui,/Vinculación verificada con la partida histórica existente/);
 assert.match(ui,/no se creó ni renumeró ninguna partida/);
 assert.doesNotMatch(src,/qa_append_batch_v253|create_.*reposition_by_decree/);
});
test('V254 PostgreSQL fixture refuses historical rows even if someone disguises the flow',()=>{
 const sql=fs.readFileSync('scripts/qa-v253-ledger-transactions.sql','utf8');
 const bash=fs.readFileSync('scripts/ci-ledger-transactions-v253.sh','utf8');
 assert.match(sql,/coalesce\(val->>'flow',''\) NOT IN \('new_sacrament','new_decree_supplement'\)/);
 assert.match(sql,/historical|legacy/);
 assert.match(sql,/val->>'book_number'/);
 assert.match(sql,/decree_effect/);
 for(const text of ['historical imports cannot consume new book memory',
  'existing historical physical coordinates cannot be submitted to new seating',
  'a correction of an existing record cannot create supplementary partida'])
  assert.ok(bash.includes(text),text);
});
test('V254 historical association SQL links existing records and never touches book memory',()=>{
 const sql=fs.readFileSync('scripts/qa-v254-link-existing-historical-decrees.sql','utf8');
 const ci=fs.readFileSync('scripts/ci-historical-decree-link-v254.sh','utf8');
 const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/WHERE id=p_decree_id FOR UPDATE/);
 assert.match(sql,/source_verified IS DISTINCT FROM TRUE/);
 assert.match(sql,/original_match_not_unique/);
 assert.match(sql,/replacement_match_not_unique/);
 assert.match(sql,/CREATE TRIGGER t_v254_link_events_immutable/);
 assert.match(sql,/REVOKE ALL ON FUNCTION sacramentum_ledger\.qa_link_historical_decree_v254/);
 assert.doesNotMatch(sql,/UPDATE sacramentum_ledger\.book_memories|INSERT INTO public\.baptisms|INSERT INTO public\.confirmations|INSERT INTO public\.marriages|INSERT INTO public\.funerals/i);
 assert.match(ci,/Historical link consumed book memory/);
 assert.match(ci,/Ambiguous\/missing record was linked/);
 assert.match(ci,/historical link history is immutable/);
 assert.match(workflow,/bash scripts\/ci-historical-decree-link-v254\.sh/);
});
test('V254 boundary test is a mandatory CI gate',()=>{
 for(const file of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
 assert.match(fs.readFileSync(file,'utf8'),/test-historical-new-boundary-v254\.mjs/);
});

test('V254 core numbering itself denies historic and previously numbered records',async()=>{
 const {initializeBookMemory,planSacramentalBatch,nextBookCoordinates}=await import('../src/domain/sacramentalLedgerSequence.mjs');
 const m=initializeBookMemory({book:'0001A',firstFolio:4,firstNumber:100,entriesPerFolio:2});
 const correct={id:'pending-qa-01',registrationNumber:'100',celebrationDate:'2026-10-27',
  celebrationVerified:true,flow:'new_sacrament'};
 const common={memory:m,records:[correct],today:'2026-10-28',
  requestedFirst:{book:m.book,folio:nextBookCoordinates(m).folio,number:nextBookCoordinates(m).number}};
 assert.equal(planSacramentalBatch(common).seats.length,1);
 for(const row of [
  {...correct,flow:'historical_import'},
  {...correct,flow:'historical_direct'},
  {...correct,flow:undefined},
  {...correct,recordOrigin:'legacy_import'},
  {...correct,Libro:'0001A',folio:'0004',numero:'0100'},
  {...correct,flow:'new_decree_supplement',decreeEffect:'existing_record'}
 ])assert.throws(()=>planSacramentalBatch({...common,records:[row]}));
 const freshDecree={...correct,flow:'new_decree_supplement',
  decreeEffect:'create_supplementary_record',decreeId:'qa-new-decree-01'};
 assert.equal(planSacramentalBatch({...common,records:[freshDecree]}).seats.length,1);
 assert.equal(m.used,0);
});
