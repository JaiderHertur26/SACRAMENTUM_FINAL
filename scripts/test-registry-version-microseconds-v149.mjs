import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRegistryVersionMicros, verifyRegistryPrintReceipt } from '../src/utils/registryPrintReceipt.js';

const read = path => fs.readFileSync(path, 'utf8');
const service = read('src/services/marginalNotesV2Service.js');
const baptismService = read('src/services/sacramentsService.js');
const marriageService = read('src/services/marriagesCloudService.js');
const funeralService = read('src/services/funeralsService.js');
const ui = [
  ['Bautismo', read('src/components/modals/ViewBaptismPartidaModal.jsx')],
  ['Confirmacion', read('src/components/modals/ViewConfirmationPartidaModal.jsx')],
  ['Matrimonio', read('src/components/modals/ViewMarriagePartidaModal.jsx')],
  ['Exequias', read('src/pages/parish/FuneralPartidasPage.jsx')]
];

const micros = '2026-10-22T18:57:17.123456+00:00';
test('V149 conserva los seis digitos de la version de PostgreSQL', () => {
  assert.equal(parseRegistryVersionMicros(micros), 1792695437123456n);
});
test('V149 reconoce el mismo instante con diferentes husos horarios', () => {
  assert.equal(parseRegistryVersionMicros('2026-10-22T13:57:17.123456-05:00'), parseRegistryVersionMicros(micros));
});
test('V149 no confunde dos modificaciones dentro del mismo milisegundo', () => {
  const a='2026-10-22T18:57:17.123001Z', b='2026-10-22T18:57:17.123002Z';
  assert.equal(Date.parse(a),Date.parse(b)); // reproduce el defecto de precision de Date.parse
  assert.notEqual(parseRegistryVersionMicros(a),parseRegistryVersionMicros(b));
});
test('V149 acepta precision de segundos, milisegundos y microsegundos', () => {
  assert.equal(parseRegistryVersionMicros('2026-10-22T18:57:17Z'), parseRegistryVersionMicros('2026-10-22T18:57:17.000000Z'));
  assert.equal(parseRegistryVersionMicros('2026-10-22T18:57:17.123Z'), parseRegistryVersionMicros('2026-10-22T18:57:17.123000Z'));
});
for(const invalid of ['', 'ayer', '2026-10-22T18:57:17', '2026-10-22T18:57:17.1234567Z', '2026-15-99T18:57:17Z', null, undefined]){
  test('V149 rechaza version registral sin formato canonico: '+String(invalid),()=>{
    assert.equal(parseRegistryVersionMicros(invalid),null);
  });
}
const hash='a'.repeat(64);
const base={
  receipt:{id:'print-qa',parish_id:'p-qa',sacrament_type:'bautismo',sacrament_id:'r-qa',
    document_kind:'partida',included_notes:[],metadata:{
      note_provenance_validation:'server_persisted_with_explicit_legacy_exception',
      record_status:'seated',record_updated_at:'2026-10-22T18:57:17.123456Z',
      book:'1',folio:'20',number:'25',coordinates_checked:true,record_version_checked:true,
      document_sha256:hash,document_sha256_provenance:'client_digest_not_server_certification'
    }},
  parishId:'p-qa',sacramentType:'bautismo',sacramentId:'r-qa',
  expectedStatus:'seated',expectedCoordinates:{book:'1',folio:'20',number:'25'},
  expectedRecordUpdatedAt:'2026-10-22T13:57:17.123456-05:00',
  expectedDocumentHash:hash,includedNotes:[]
};
const verified = expectedRecordUpdatedAt=>verifyRegistryPrintReceipt({...base,expectedRecordUpdatedAt});
test('V149 constancia de impresion acepta microsegundos y huso horario coincidentes',()=>{
  assert.equal(verified(base.expectedRecordUpdatedAt).id,'print-qa');
});
test('V149 constancia de impresion rechaza una sola diferencia de microsegundo',()=>{
  assert.throws(()=>verified('2026-10-22T18:57:17.123455Z'),/versi[oó]n/);
});
test('V149 constancia de impresion rechaza microsegundo mas reciente sin cambiar coordenadas',()=>{
  assert.throws(()=>verified('2026-10-22T18:57:17.123457Z'),/versi[oó]n/);
});
test('V149 servicio exige version antes de auditoria o impresion',()=>{
  const guard=service.indexOf('if (parseRegistryVersionMicros(expectedRecordUpdatedAt) === null)');
  const rpc=service.indexOf("supabase.rpc('register_registry_print'");
  assert.ok(guard>0 && rpc>guard);
  assert.match(service,/Falta la versi[oó]n can[oó]nica de la partida/);
  assert.match(service,/expected_record_updated_at: expectedRecordUpdatedAt/);
  assert.doesNotMatch(service,/\.\.\.\(expectedRecordUpdatedAt \?/);
});
test('V149 Bautismo y Confirmacion cargan version actual canónica y no solo raw_data',()=>{
  assert.match(baptismService,/updatedAt: raw\.updated_at/);
  assert.match(baptismService,/\.from\('baptisms'\)\s*\.select\('\*'\)/);
  assert.match(baptismService,/\.from\('confirmations'\)\.select\('\*'\)/);
});
test('V149 Matrimonio mapea updated_at de Supabase y Exequias conserva columna canonica',()=>{
  assert.match(marriageService,/updatedAt: row\.updated_at/);
  assert.match(marriageService,/\.from\(TABLE_NAMES\.MARRIAGES\)\s*\.select\('\*'\)/);
  assert.match(funeralService,/\.from\(TABLE_NAMES\.FUNERALS\)\s*\.select\('\*'\)/);
  assert.match(funeralService,/return data \|\| \[\]/);
});
for(const [kind,code] of ui){
  test('V149 '+kind+' adjunta version de la partida al solicitar impresion',()=>{
    assert.match(code,/expectedRecordUpdatedAt:\s*(partida|selected|record)\.updated_at/);
  });
}
test('V149 Exequias verifica version tanto en partida como en constancia',()=>{
  assert.equal((ui[3][1].match(/expectedRecordUpdatedAt:/g)||[]).length,2);
});
