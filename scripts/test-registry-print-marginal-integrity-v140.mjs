import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildFuneralConstanciaHtml } from '../src/utils/funeralDocumentHtml.js';

const read=f=>fs.readFileSync(f,'utf8');
const base=read('supabase/migrations/20261022172147_validate_registry_print_notes_server_v140.sql');
const final=read('supabase/migrations/20261022173154_preserve_audited_civil_link_helpers_v141.sql');
const baseline=read('scripts/qa-rollback-mandatory-note-print-baseline-v140.sql');
const testMain=read('scripts/qa-rollback-registry-print-integrity-v140.sql');
const testDecree=read('scripts/qa-rollback-print-reversed-decree-notes-v140.sql');
const testCivil=read('scripts/qa-rollback-auto-civil-registry-print-v141.sql');
const notes=read('src/services/marginalNotesV2Service.js');
const funerals=read('src/services/funeralService.js');
const marriage=read('src/components/modals/ViewMarriagePartidaModal.jsx');
const funeralPage=read('src/pages/parish/FuneralPartidasPage.jsx');
const funeralHTML=read('src/utils/funeralDocumentHtml.js');

test('V140 conserva firma de impresión privilegiada sin abrir tabla a cliente',()=>{
 assert.match(base,/CREATE OR REPLACE FUNCTION public.register_registry_print\(/);
 assert.match(base,/SECURITY DEFINER/);
 assert.match(base,/can_access_parish\(p_parish_id\)/);
});
test('V140 coteja el UUID de nota con su partida, tipo sacramental y parroquia',()=>{
 assert.match(base,/n.id=v_note_uuid and n.parish_id=p_parish_id/);
 assert.match(base,/n.sacrament_id=p_sacrament_id and n.sacrament_type=v_type/);
 assert.match(base,/for share;/);
});
test('V140 la nota obligatoria activa no puede omitirse del lote impreso',()=>{
 assert.match(base,/n.print_policy='required'/);
 assert.match(base,/not \(n.id::text=any\(v_seen\)\)/);
 assert.match(base,/Falta incorporar una nota marginal obligatoria vigente antes de imprimir/);
});
test('V140 excluye notas internas, inactivas o pertenecientes a decretos revertidos',()=>{
 assert.match(base,/v_note.print_policy='internal'/);
 assert.match(base,/v_note.status,'active'\)\) in \('reversed','revertida','deleted','cancelled','anulada'\)/);
 assert.match(base,/v_decree_status in \('reversed','cancelled','anulada','annulled'\)/);
});
test('V140 preserva las notas reversionales aún cuando el decreto tenga estado reversed',()=>{
 assert.match(base,/v_note.note_type,''\)\) not like 'reversion%'/);
 assert.match(base,/n.note_type,''\)\) like 'reversion%'/);
});
test('V140 la bitácora conserva únicamente texto, label y policy canónicos del servidor',()=>{
 assert.match(base,/v_note_item->>'content' is distinct from v_note.content/);
 assert.match(base,/v_note_item->>'policy',''\) is distinct from v_note.print_policy/);
 assert.match(base,/v_verified_notes:=v_verified_notes\|\|jsonb_build_array/);
 assert.match(base,/'provenance','persisted_verified'/);
 assert.match(base,/    v_verified_notes,/);
});
test('V140 impide identidades inventadas, notas repetidas y selección no imprimida',()=>{
 assert.match(base,/v_note_key is null or v_note_key=any\(v_seen\)/);
 assert.match(base,/v_note_key !~\*/);
 assert.match(base,/v_selected_key<>all\(v_seen\)/);
});
test('V140 mantiene trazabilidad de notas históricas sin certificarlas como base digital',()=>{
 assert.match(base,/"?legacy-inline"?/);
 assert.match(base,/'client_supplied_unverified_historical'/);
 assert.match(base,/'contains_unverified_legacy_inline',v_legacy_inline_unverified/);
});
test('V140 registra el estado canónico de la partida e identidad histórica',()=>{
 assert.match(base,/'record_status',coalesce\(v_record_status,'unknown'\)/);
 assert.match(base,/'historical_record',lower\(coalesce\(v_record_status,'seated'\)\)/);
 assert.match(base,/'coordinates_source','record_snapshot'/);
});
test('V140 prueba real reproduce omisión de nota obligatoria previa a migración',()=>{
 assert.match(baseline,/V140-CONFIRMED/);
 assert.match(baseline,/'required',true/);
 assert.ok(baseline.includes("ARRAY[]::text[],'[]'::jsonb"));
});
test('V140 matriz SQL niega siete actuaciones inválidas y acepta tres impresiones',()=>{
 assert.match(testMain,/v_denied<>7 OR v_ok<>3/);
 for(const phrase of ['mandatory note','forged printed text','internal note','reversed note','other sacramental record','phantom selected note','duplicated included note'])
  assert.ok(testMain.includes(phrase),phrase);
});
test('V140 coteja nota requerida contra contenido real y rechaza etiqueta fingida',()=>{
 assert.match(testMain,/v_row.included_notes->0->>'label'<>'qa-required'/);
 assert.match(testMain,/v_row.included_notes->0->>'content'<>'QA V140 TEXTO OBLIGATORIO'/);
});
test('V140 reversión de decreto: nota antigua rechazada y nota de reversión requerida',()=>{
 assert.match(testDecree,/v_denied<>2 OR v_approved<>1/);
 assert.match(testDecree,/'reversion_correccion_original'/);
 assert.match(testDecree,/'correccion_original'/);
 assert.match(testDecree,/v_row.included_notes->0->>'provenance'/);
});
test('V141 permite nota automática civil solo de la misma partida y con fuente NUIP/serial',()=>{
 assert.match(final,/v_note_key='auto-rc-'\|\|p_sacrament_id::text/);
 assert.match(final,/v_nuip is null and v_serial is null/);
 assert.match(final,/position\(upper\(v_nuip\) in upper\(v_note_item->>'content'\)\)/);
});
test('V141 marca las notas civiles compuestas como no verificadas digitalmente',()=>{
 assert.match(final,/'client_rendered_registry_fields_unverified'/);
 assert.match(final,/'contains_unverified_derived_note',v_derived_unverified/);
 assert.match(final,/'provenance','persisted_verified'/);
});
test('V141 laboratorio rechaza tres falsificaciones y conserva nota civil legítima',()=>{
 assert.match(testCivil,/v_denied<>3/);
 assert.match(testCivil,/QA141NUIP0001/);
 assert.match(testCivil,/V141-FAIL: nota civil sin NUIP en partida permitida/);
 assert.match(testCivil,/V141-FAIL: vínculo civil ID de otra partida permitido/);
});
test('V141 lista marginales excluye nota de decreto revertido y conserva nota reversional',()=>{
 assert.match(notes,/linked_decree:decretos!marginal_notes_decree_id_fkey\(status\)/);
 assert.match(notes,/isIneffectiveDecreeNote/);
 assert.match(notes,/startsWith\('reversion'\)/);
 assert.match(notes,/inlineWasReversed/);
});
test('V141 Matrimonio nunca reincorpora nota histórica anulada por fallback raw',()=>{
 assert.match(marriage,/let rawMarginText = printableNotes.join\(' \/\/ '\) \|\| "";/);
 assert.doesNotMatch(marriage,/printableNotes.join\(' \/\/ '\) \|\| partida.notaMarginal/);
});
test('V141 Exequias carga política de impresión y decreto asociado antes de elegir notas',()=>{
 assert.match(funerals,/print_policy, print_default, print_label, decree_id, linked_decree/);
 assert.match(funerals,/note.note_type\|\|''\).toLowerCase\(\).startsWith\('reversion'\)/);
});
test('V141 Exequias incluye notas obligatorias aunque no se seleccione todas',()=>{
 assert.match(funeralPage,/printNotes \|\| note.print_policy === 'required'/);
 assert.match(funeralPage,/selectedNoteKeys: printableNotes.map/);
 assert.match(funeralPage,/notes: printableNotes/);
});
test('V141 Constancia de Exequias comprueba notas propias y registra su contenido',()=>{
 assert.match(funeralPage,/await getFuneralMarginalNotesCloud\(record.id\)/);
 assert.match(funeralPage,/requiredSlipNotes = currentNotes.filter/);
 assert.match(funeralPage,/notes: requiredSlipNotes/);
 assert.match(funeralHTML,/NOTAS MARGINALES OBLIGATORIAS/);
});
test('V141 el HTML de Constancia representa la nota obligatoria escapada y no omite texto',()=>{
 const html=buildFuneralConstanciaHtml({record:{nombres:'PRUEBA',apellidos:'V141'},notes:[{content:'ANOTACIÓN <ORIGINAL>'}],institution:{}});
 assert.match(html,/ANOTACIÓN &lt;ORIGINAL&gt;/);
 assert.match(html,/NOTAS MARGINALES OBLIGATORIAS/);
});
for(const [name,sql] of [['baseline',baseline],['matriz',testMain],['decreto',testDecree],['civil',testCivil]]){
 test('V140/V141 '+name+' no puede persistir datos de QA',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}

const fourSacraments=read('scripts/qa-rollback-registry-print-four-sacraments-v141.sql');
test('V141 nota obligatoria se valida realmente en los cuatro sacramentos',()=>{
 for(const kind of ['bautismo','confirmacion','matrimonio','exequias'])
  assert.ok(fourSacraments.includes("'"+kind+"'"),kind);
 assert.match(fourSacraments,/v_denied<>4 OR v_accepted<>4/);
 assert.match(fourSacraments,/PERFORM public.register_registry_print\(v_parish,v_type,v_record,'partida',ARRAY\[\]::text\[\],'\\[\\]'::jsonb|PERFORM public.register_registry_print\(v_parish,v_type,v_record,'partida'/);
});
test('V141 el ensayo de los cuatro sacramentos es completamente reversible',()=>{
 assert.match(fourSacraments,/^BEGIN;$/m);
 assert.match(fourSacraments,/ROLLBACK;\s*$/);
 assert.doesNotMatch(fourSacraments,/^\s*COMMIT\b/im);
});
