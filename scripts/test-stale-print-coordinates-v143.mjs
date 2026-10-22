import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256PrintedHtml,normalizePrintCoordinates,verifyRegistryPrintReceipt} from '../src/utils/registryPrintReceipt.js';

const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261022180645_guard_stale_registry_print_document_v143.sql');
const baseline=read('scripts/qa-rollback-stale-print-coordinates-baseline-v143.sql');
const qa=read('scripts/qa-rollback-print-optimistic-coordinates-v143.sql');
const service=read('src/services/marginalNotesV2Service.js');
const modals=[
 {type:'bautismo',code:read('src/components/modals/ViewBaptismPartidaModal.jsx')},
 {type:'confirmacion',code:read('src/components/modals/ViewConfirmationPartidaModal.jsx')},
 {type:'matrimonio',code:read('src/components/modals/ViewMarriagePartidaModal.jsx')},
];
const funerals=read('src/pages/parish/FuneralPartidasPage.jsx');
const hash='a'.repeat(64);
const base={
  receipt:{
    id:'qa-print',parish_id:'p1',sacrament_type:'bautismo',sacrament_id:'r1',document_kind:'partida',
    included_notes:[],
    metadata:{note_provenance_validation:'server_persisted_with_explicit_legacy_exception',
      record_status:'seated',record_updated_at:'2026-10-22T12:00:00.000000Z',
      book:'1',folio:'443',number:'531',coordinates_checked:true,record_version_checked:true,
      document_sha256:hash,document_sha256_provenance:'client_digest_not_server_certification'}
  },
  parishId:'p1',sacramentType:'bautismo',sacramentId:'r1',documentKind:'partida',
  expectedStatus:'seated',includedNotes:[],expectedCoordinates:{book:'1',folio:'443',number:'531'},
  expectedRecordUpdatedAt:'2026-10-22T07:00:00-05:00',expectedDocumentHash:hash
};
const run=(props={})=>verifyRegistryPrintReceipt({...base,...props,
 receipt:props.receipt===null?null:{...base.receipt,...props.receipt,
  metadata:props.receipt?.metadata===undefined?base.receipt.metadata:{...base.receipt.metadata,...props.receipt.metadata}}});
test('V143 reconoce la instantánea de libro, folio, número, versión y huella correcta',()=>{
 assert.equal(run().id,'qa-print');
});
test('V143 sha256 calcula valor conocido y distingue un solo carácter cambiado',async()=>{
 assert.equal(await sha256PrintedHtml('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const left=await sha256PrintedHtml('<p>Folio 443</p>');
 const right=await sha256PrintedHtml('<p>Folio 444</p>');
 assert.match(left,/^[0-9a-f]{64}$/);
 assert.notEqual(left,right);
});
test('V143 rechaza huella de documento sin HTML real',async()=>{
 await assert.rejects(sha256PrintedHtml(''),/contenido congelado/);
});
test('V143 serializa las coordenadas incluyendo vacíos sin inventar datos',()=>{
 assert.deepEqual(normalizePrintCoordinates({book:1,folio:null,number:2}),{book:'1',folio:'',number:'2'});
});
test('V143 exige coordenadas completas',()=>{
 assert.throws(()=>normalizePrintCoordinates({book:'1',folio:'2'}),/Libro, folio y número/);
});
test('V143 rechaza cambio de libro',()=>assert.throws(()=>run({receipt:{metadata:{book:'2'}}}),/Libro, folio o número/));
test('V143 rechaza cambio de folio',()=>assert.throws(()=>run({receipt:{metadata:{folio:'444'}}}),/Libro, folio o número/));
test('V143 rechaza cambio de número',()=>assert.throws(()=>run({receipt:{metadata:{number:'532'}}}),/Libro, folio o número/));
test('V143 rechaza recibo cuyo servidor no marcó la comprobación de coordenadas',()=>assert.throws(()=>run({receipt:{metadata:{coordinates_checked:false}}}),/Libro, folio o número/));
test('V143 rechaza cambio posterior de versión aunque estado y coordenadas coincidan',()=>{
 assert.throws(()=>run({receipt:{metadata:{record_updated_at:'2026-10-22T12:00:01.000000Z'}}}),/versión/);
});
test('V143 compara instantes de hora UTC iguales aunque zonas horarias difieran',()=>{
 assert.equal(run().id,'qa-print');
});
test('V143 rechaza constancia de versión que no fue revisada en base de datos',()=>{
 assert.throws(()=>run({receipt:{metadata:{record_version_checked:false}}}),/versión/);
});
test('V143 rechaza fuente temporal inválida',()=>{
 assert.throws(()=>run({expectedRecordUpdatedAt:'fecha-inválida'}),/versión/);
});
test('V143 rechaza SHA-256 cambiado',()=>assert.throws(()=>run({receipt:{metadata:{document_sha256:'b'.repeat(64)}}}),/huella/));
test('V143 rechaza hash no SHA-256',()=>assert.throws(()=>run({expectedDocumentHash:'ABC123'}),/huella/));
test('V143 no presenta la huella de cliente como prueba de certificación del servidor',()=>{
 assert.throws(()=>run({receipt:{metadata:{document_sha256_provenance:'server_certified'}}}),/huella/);
});
test('V143 el RPC compara coordenadas contra fuente canónica en la misma transacción',()=>{
 assert.match(sql,/v_expected_coordinates->>'book' is distinct from coalesce\(v_book,''\)/);
 assert.match(sql,/v_expected_coordinates->>'folio' is distinct from coalesce\(v_folio,''\)/);
 assert.match(sql,/v_expected_coordinates->>'number' is distinct from coalesce\(v_number,''\)/);
 assert.match(sql,/Coordenadas de impresión ausentes o mal formadas/);
});
test('V143 RPC coteja sello updated_at según instante, no solo status',()=>{
 assert.match(sql,/v_record_updated_at is distinct from \(v_client_updated_at::timestamptz\)/);
 assert.match(sql,/La partida fue modificada después de cargarse/);
 assert.match(sql,/record_version_checked/);
});
test('V143 RPC registra hash con procedencia client-side explícitamente no certificada',()=>{
 assert.match(sql,/v_client_html_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(sql,/client_digest_not_server_certification/);
 assert.match(sql,/document_sha256_provenance/);
});
test('V143 seguridad retrocompatible: antiguas solicitudes quedan señaladas como no cotejadas',()=>{
 assert.match(sql,/coordinates_checked',p_metadata \? 'expected_coordinates'/);
 assert.match(sql,/record_version_checked',v_client_updated_at is not null/);
 assert.match(qa,/v_legacy<>4/);
});
test('V143 QA SQL reproduce defecto anterior con folio 222 frente a 333',()=>{
 assert.match(baseline,/V143-CONFIRMED/);
 assert.match(baseline,/folio','222'/);
 assert.match(baseline,/VALUES\(v_parish,'seated',DATE '2021-01-01'.*'333'/);
});
test('V143 QA real ensaya 4 sacramentos x 6 negativas + 4 válidas y 4 legacy',()=>{
 for(const t of ['bautismo','confirmacion','matrimonio','exequias'])assert.ok(qa.includes("'"+t+"'"));
 assert.match(qa,/v_passed<>4 OR v_denied<>24 OR v_legacy<>4/);
 assert.match(qa,/V143-FAIL: versión anterior autorizada/);
});
test('V143 cliente calcula digest antes de RPC, nunca confía en metadatos arbitrarios',()=>{
 assert.match(service,/const documentHash = await sha256PrintedHtml\(htmlSnapshot\)/);
 assert.match(service,/expected_coordinates: coordinates/);
 assert.match(service,/document_sha256: documentHash/);
 assert.match(service,/p_metadata: printMetadata/);
 assert.match(service,/expectedDocumentHash: documentHash/);
});
for(const {type,code} of modals){
 test('V143 '+type+' envía huella del HTML congelado, versión y coordenadas para cotejo',()=>{
  assert.match(code,/htmlSnapshot \}\);/);
  assert.match(code,/expectedCoordinates: \{ book: partida.book_number/);
  assert.match(code,/expectedRecordUpdatedAt: partida.updated_at/);
  assert.ok(code.indexOf('const htmlSnapshot = ')<code.indexOf('await registerRegistryPrint('));
 });
}
test('V143 Exequias partida y constancia incluyen versión/coordenadas/digest',()=>{
 assert.equal((funerals.match(/htmlSnapshot: printHtmlSnapshot/g)||[]).length,2);
 assert.equal((funerals.match(/expectedCoordinates: \{ book:/g)||[]).length,2);
 assert.equal((funerals.match(/expectedRecordUpdatedAt: /g)||[]).length,2);
});
for(const [name,body] of [['defecto original',baseline],['matriz multilibro',qa]]){
 test('V143 SQL '+name+' solo opera dentro de transacción reversible',()=>{
  assert.match(body,/^BEGIN;$/m);
  assert.match(body,/ROLLBACK;\s*$/);
  assert.doesNotMatch(body,/^\s*COMMIT\b/im);
 });
}
