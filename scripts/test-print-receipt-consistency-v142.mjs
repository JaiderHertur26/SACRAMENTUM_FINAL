import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyRegistryPrintReceipt,normalizePrintedNotes} from '../src/utils/registryPrintReceipt.js';
const read=f=>fs.readFileSync(f,'utf8');
const service=read('src/services/marginalNotesV2Service.js');
const baptism=read('src/components/modals/ViewBaptismPartidaModal.jsx');
const confirmation=read('src/components/modals/ViewConfirmationPartidaModal.jsx');
const marriage=read('src/components/modals/ViewMarriagePartidaModal.jsx');
const funerals=read('src/pages/parish/FuneralPartidasPage.jsx');
const fixture=read('scripts/qa-rollback-print-receipt-authenticated-v142.sql');
const note={id:'note-qa',policy:'required',content:'TEXTO REGISTRAL FICTICIO'};
const base={
 receipt:{
  id:'event-qa',
  parish_id:'parish-qa',
  sacrament_type:'bautismo',
  sacrament_id:'record-qa',
  document_kind:'partida',
  included_notes:[{...note,label:'Etiqueta canónica',provenance:'persisted_verified'}],
  metadata:{note_provenance_validation:'server_persisted_with_explicit_legacy_exception',record_status:'seated',book:'QA143',folio:'443',number:'531',coordinates_checked:true,record_version_checked:false,document_sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',document_sha256_provenance:'client_digest_not_server_certification'}
 },
 parishId:'parish-qa',
 sacramentType:'bautismo',
 sacramentId:'record-qa',
 documentKind:'partida',
 includedNotes:[{...note,label:'Etiqueta de pantalla'}],
 expectedStatus:'seated',
 expectedCoordinates:{book:'QA143',folio:'443',number:'531'},
 expectedDocumentHash:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
};
const run=(change={})=>verifyRegistryPrintReceipt({...base,...change,receipt:change.receipt===null?null:{...base.receipt,...(change.receipt||{})}});
test('V142 permite evento correcto: nota textual exacta, identidad, documento y estado',()=>{
 assert.equal(run().id,'event-qa');
});
test('V142 normalización conserva orden, contenido e id',()=>{
 assert.deepEqual(normalizePrintedNotes([{id:12,policy:'optional',content:'X'}]),[{id:'12',policy:'optional',content:'X'}]);
});
test('V142 rechaza constancia ausente',()=>assert.throws(()=>run({receipt:null}),/constancia/));
test('V142 rechaza parroquia ajena',()=>assert.throws(()=>run({receipt:{parish_id:'parish-outside'}}),/constancia/));
test('V142 rechaza otro sacramento',()=>assert.throws(()=>run({receipt:{sacrament_type:'confirmacion'}}),/constancia/));
test('V142 rechaza partida ajena',()=>assert.throws(()=>run({receipt:{sacrament_id:'other-record'}}),/constancia/));
test('V142 rechaza constancia de tipo equivocado',()=>assert.throws(()=>run({receipt:{document_kind:'constancia'}}),/constancia/));
test('V142 rechaza evento sin sello de control de procedencia V140',()=>assert.throws(()=>run({receipt:{metadata:{record_status:'seated'}}}),/constancia/));
test('V142 rechaza supresión de nota obligatoria',()=>assert.throws(()=>run({receipt:{included_notes:[]}}),/notas/));
test('V142 rechaza añadido de nota no autorizada',()=>assert.throws(()=>run({includedNotes:[]}),/notas/));
test('V142 rechaza texto marginal distinto al registrado',()=>assert.throws(()=>run({receipt:{included_notes:[{...note,content:'ALTERADA'}]}}),/notas/));
test('V142 rechaza política marginal distinta',()=>assert.throws(()=>run({receipt:{included_notes:[{...note,policy:'optional'}]}}),/notas/));
test('V142 rechaza UUID de nota distinto',()=>assert.throws(()=>run({receipt:{included_notes:[{...note,id:'fake-note'}]}}),/notas/));
test('V142 rechaza cambio de orden en las notas',()=>{
 const two=[{id:'A',policy:'required',content:'uno'},{id:'B',policy:'optional',content:'dos'}];
 assert.throws(()=>run({includedNotes:two,receipt:{included_notes:[two[1],two[0]]}}),/notas/);
});
test('V142 permite etiqueta canónica distinta: el texto y la política sí son autoritativos',()=>assert.equal(run().id,'event-qa'));
test('V142 rechaza estado de partida modificado mientras espera servidor',()=>assert.throws(()=>run({receipt:{metadata:{...base.receipt.metadata,record_status:'anulada'}}}),/estado registral/));
test('V142 rechaza constancia de estado desconocido',()=>assert.throws(()=>run({receipt:{metadata:{...base.receipt.metadata,record_status:''}}}),/estado registral/));
test('V142 rechaza notas del evento mal formadas',()=>assert.throws(()=>run({receipt:{included_notes:null}}),/lista de notas/));
test('V142 una nota inline sin certificación digital requiere cotejo de contenido exacto',()=>{
 const inline={id:'legacy-inline',policy:'optional',content:'TRANSCRIPCIÓN HISTÓRICA'};
 assert.equal(run({includedNotes:[inline],receipt:{included_notes:[{...inline,provenance:'client_supplied_unverified_historical'}]}}).id,'event-qa');
 assert.throws(()=>run({includedNotes:[inline],receipt:{included_notes:[{...inline,content:'DISTINTA'}]}}),/notas/);
});
test('V142 servicio exige lectura real de constancia RLS y no se limita a UUID de impresión',()=>{
 assert.match(service,/from\('registry_print_events'\)/);
 assert.match(service,/\.eq\('id', data\)/);
 assert.match(service,/\.single\(\)/);
 assert.match(service,/if \(receiptError\) throw receiptError/);
 assert.match(service,/return verifyRegistryPrintReceipt/);
 assert.match(service,/expectedStatus=''/);
});
for(const [kind,code,dom] of [['bautismo',baptism,'contenido'],['confirmacion',confirmation,'contenido'],['matrimonio',marriage,'printContent']]){
 test('V142 '+kind+' congela HTML/selección antes de auditar y usa snapshot al imprimir',()=>{
  const snap=code.indexOf('const htmlSnapshot = '+dom+'.innerHTML;');
  const awaited=code.indexOf('await registerRegistryPrint(');
  const printed=code.indexOf('doc.write(htmlSnapshot);');
  assert.ok(snap>0&&snap<awaited&&awaited<printed);
  assert.match(code,/const selectedNoteSnapshot = \[\.\.\.selectedNotes\].map\(String\)/);
  assert.match(code,/selectedNoteKeys: selectedNoteSnapshot/);
  assert.match(code,/includedNotes: includedNoteSnapshot/);
  assert.match(code,/expectedStatus: partida.status \|\| partida.estado \|\| ''/);
  assert.doesNotMatch(code,/doc.write\((contenido|printContent)\.innerHTML\)/);
 });
}
test('V142 Exequias genera HTML de partida antes de registrar evento y no lo recalcula después',()=>{
 const start=funerals.indexOf('const printCertificate = async () =>');
 const end=funerals.indexOf('const printFuneralSlip = async',start);
 const block=funerals.slice(start,end);
 assert.ok(block.indexOf('const printHtmlSnapshot = buildFuneralPartidaHtml(')<block.indexOf('await registerRegistryPrint('));
 assert.ok(block.indexOf('await registerRegistryPrint(')<block.indexOf('popup.document.write(printHtmlSnapshot)'));
 assert.match(block,/expectedStatus/);
});
test('V142 Exequias genera HTML de constancia antes del RPC y no lo recalcula después',()=>{
 const start=funerals.indexOf('const printFuneralSlip = async');
 const block=funerals.slice(start,funerals.indexOf('\n  return (',start));
 assert.ok(block.indexOf('const printHtmlSnapshot = buildFuneralConstanciaHtml(')<block.indexOf('await registerRegistryPrint('));
 assert.ok(block.indexOf('await registerRegistryPrint(')<block.indexOf('popup.document.write(printHtmlSnapshot)'));
 assert.match(block,/requiredSlipNotes = currentNotes.filter/);
 assert.match(block,/expectedStatus/);
});
test('V142 SQL comprueba que mismo actor parroquial puede leer la constancia en cada sacramento',()=>{
 for(const name of ['bautismo','confirmacion','matrimonio','exequias'])assert.ok(fixture.includes("'"+name+"'"));
 assert.match(fixture,/SELECT \* INTO STRICT v_row FROM public.registry_print_events/);
 const readIdx=fixture.indexOf('SELECT * INTO STRICT v_row FROM public.registry_print_events');
 const resetIdx=fixture.indexOf("EXECUTE 'RESET ROLE'");
 assert.ok(readIdx>=0&&readIdx<resetIdx);
 assert.match(fixture,/v_row.requested_by IS DISTINCT FROM v_actor/);
 assert.match(fixture,/v_row.metadata->>'record_status' IS DISTINCT FROM 'seated'/);
 assert.match(fixture,/ROLLBACK;\s*$/);
 assert.doesNotMatch(fixture,/^\s*COMMIT\b/im);
});
