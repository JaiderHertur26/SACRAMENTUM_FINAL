import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getCanonicalRegistryCoordinates as ref} from '../src/utils/canonicalRegistryCoordinates.js';
import {buildFuneralPartidaHtml} from '../src/utils/funeralDocumentHtml.js';
import {verifyRegistryPrintReceipt} from '../src/utils/registryPrintReceipt.js';
const read=path=>fs.readFileSync(path,'utf8');
const migration=read('supabase/migrations/20261024212500_guard_print_integrity_v194.sql');
const qa=read('scripts/qa-rollback-print-integrity-v194.sql');

test('V194 raw_data histórico nunca sobrescribe libro, folio y número canónicos',()=>{
 const row={book_number:'0031',folio:'0442',number:'0888',raw_data:{Libro:'9999',folio:'9998',numero:'9997'}};
 assert.deepEqual(ref(row),{book:'0031',folio:'0442',number:'0888'});
});
test('V194 datos históricos sobreviven solamente cuando falta coordenada canónica',()=>{
 assert.deepEqual(ref({raw_data:{Libro:'0009',folio:'0010',numero:'0011'}}),{book:'0009',folio:'0010',number:'0011'});
 assert.deepEqual(ref({book_number:'',folio:'',number:'',raw_data:{Libro:'9999',folio:'9998',numero:'9997'}}),
 {book:'',folio:'',number:''});
});
test('V194 tres plantillas sacan coordenadas del origen canónico y no del raw histórico',()=>{
 for(const f of ['BaptismPrintTemplate','ConfirmationPrintTemplate','MatrimonioPrintTemplate']){
 const s=read('src/components/'+f+'.jsx');
 assert.match(s,/getCanonicalRegistryCoordinates\(data\)/,f);
 assert.match(s,/registryCoordinates\.book/);
 assert.match(s,/registryCoordinates\.folio/);
 assert.match(s,/registryCoordinates\.number/);
 }
});
test('V194 nombres y fecha del asiento se priorizan en Bautismo y Confirmación',()=>{
 for(const f of ['BaptismPrintTemplate','ConfirmationPrintTemplate']){
 const s=read('src/components/'+f+'.jsx');
 assert.match(s,/data\.nombres \?\? raw\.nombres/);
 assert.match(s,/data\.apellidos \?\? raw\.apellidos/);
 assert.match(s,/data\.celebration_date \?\? raw\.fechaSacramento/);
 }
});
test('V194 HTML de Exequias toma Libro/Folio/Número desde partida persistida',()=>{
 const html=buildFuneralPartidaHtml({record:{
  book_number:'0017',folio:'0441',number:'0742',book_type:'ordinario',
  nombres:'Ficticia',apellidos:'Prueba',
  raw_data:{book_number:'9000',folio:'9000',number:'9000'}
 },notes:[],institution:{parishName:'Parroquia QA'}});
 for(const val of ['0017','0441','0742'])assert.ok(html.includes('<strong>'+val+'</strong>'),val);
 assert.ok(!html.includes('<strong>9000</strong>'));
});
test('V194 trigger rechaza toda nueva constancia no cotejada pero preserva documentos antiguos',()=>{
 assert.match(migration,/BEFORE INSERT ON public\.registry_print_events/);
 assert.match(migration,/coordinates_checked.*IS DISTINCT FROM 'true'/);
 assert.match(migration,/record_version_checked.*IS DISTINCT FROM 'true'/);
 assert.match(migration,/document_sha256_provenance/);
 assert.doesNotMatch(migration,/DELETE FROM public\.registry_print_events|UPDATE public\.registry_print_events|TRUNCATE/i);
});
test('V194 QA real cubre cuatro constancias válidas y veinte rechazos, siempre reversible',()=>{
 for(const x of ['bautismo','confirmacion','matrimonio','exequias'])assert.ok(qa.includes("'"+x+"'"));
 assert.ok(qa.includes('denied<>20') && qa.includes('ok<>4'));
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.ok(qa.trimEnd().endsWith('ROLLBACK;'));
});
test('V194 constancia cliente conserva cotejo exacto de versión, notas y huella',()=>{
 const metadata={note_provenance_validation:'server_persisted_with_explicit_legacy_exception',
 record_status:'seated',coordinates_checked:true,record_version_checked:true,
 book:'0017',folio:'0441',number:'0742',record_updated_at:'2026-10-24T12:00:00.123456+00:00',
 document_sha256:'a'.repeat(64),document_sha256_provenance:'client_digest_not_server_certification'};
 const x={receipt:{id:'print-qa',parish_id:'p',sacrament_type:'bautismo',sacrament_id:'r',
 document_kind:'partida',included_notes:[],metadata},parishId:'p',sacramentType:'bautismo',
 sacramentId:'r',documentKind:'partida',includedNotes:[],expectedStatus:'seated',
 expectedCoordinates:{book:'0017',folio:'0441',number:'0742'},
 expectedRecordUpdatedAt:'2026-10-24T12:00:00.123456+00:00',expectedDocumentHash:'a'.repeat(64)};
 assert.equal(verifyRegistryPrintReceipt(x).id,'print-qa');
 assert.throws(()=>verifyRegistryPrintReceipt({...x,expectedCoordinates:{...x.expectedCoordinates,folio:'9999'}}),/Libro, folio/);
 assert.throws(()=>verifyRegistryPrintReceipt({...x,expectedDocumentHash:'b'.repeat(64)}),/huella/);
 assert.throws(()=>verifyRegistryPrintReceipt({...x,expectedRecordUpdatedAt:'2026-10-24T12:00:00.123457+00:00'}),/versión/);
});
