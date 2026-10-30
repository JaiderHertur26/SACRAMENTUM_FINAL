import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasActiveRepetitionWithoutEffect} from '../src/utils/repetitionRegistryEffect.mjs';
const read=(name)=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const fix=read('supabase/deployment/v316_repetition_uuid_aggregation_fix.sql');
const guard=read('supabase/deployment/v317_repetition_certificate_guard.sql');
const modal=read('src/components/modals/ViewBaptismPartidaModal.jsx');
const details=read('src/pages/BaptismDetailPage.jsx');
const archive=read('src/pages/parish/BaptismPartidasPage.jsx');
test('V316 no usa min(uuid), que PostgreSQL no soporta',()=>{
 assert.match(fix,/count\(\*\),\(array_agg\(id\)\)\[1\]/);
 assert.doesNotMatch(fix,/min\(id\)/i);
});
test('V317 nota válida deja la inscripción sin efectos',()=>{
 assert.equal(hasActiveRepetitionWithoutEffect([{note_type:'decree_repetition',status:'active',linked_decree:{status:'active'}}]),true);
 assert.equal(hasActiveRepetitionWithoutEffect([{note_type:'decree_repetition',status:'reversed',linked_decree:{status:'active'}}]),false);
 assert.equal(hasActiveRepetitionWithoutEffect([{note_type:'decree_repetition',status:'active',linked_decree:{status:'cancelled'}}]),false);
 assert.equal(hasActiveRepetitionWithoutEffect([{note_type:'marriage_notification',status:'active'}]),false);
});
test('V317 trigger impide certificación oficial de partida sin efectos',()=>{
 assert.match(guard,/BEFORE INSERT ON public\.registry_print_events/);
 assert.match(guard,/n\.note_type='decree_repetition'/);
 assert.match(guard,/d\.status='active' AND d\.tipo='repeticion'/);
 assert.match(guard,/lower\(coalesce\(NEW\.document_kind,''\)\)='partida'/);
 assert.doesNotMatch(guard,/DELETE FROM public\.baptisms|UPDATE public\.baptisms/i);
});
test('V317 modal no ofrece Vigente ni impresión a una partida sin efectos',()=>{
 assert.match(modal,/hasActiveRepetitionWithoutEffect\(marginalNotes\)/);
 assert.match(modal,/disabled=\{noVigente \|\| !notesVerified\}/);
 assert.match(modal,/if \(noVigente\)/);
 assert.match(modal,/Sin efectos por Decreto de Repetición/);
});
test('V317 impresión falla cerrada si la consulta de notas falla',()=>{
 assert.match(modal,/verified = true/);
 assert.match(modal,/setNotesVerified\(verified\)/);
 assert.match(modal,/if \(!notesVerified\)/);
 assert.match(modal,/return \(\) => \{ active = false; \}/);
});
test('V317 detalle no falsea Vigente cuando hay nota o error de lectura',()=>{
 assert.match(details,/const statusLabel = noteCheckFailed/);
 assert.match(details,/disabled=\{sinEfectoRepeticion \|\| noteCheckFailed\}/);
 assert.match(details,/SIN EFECTOS REGISTRALES/);
});
test('V317 índice de Bautismos verifica notas de la página con ámbito parroquial',()=>{
 assert.match(archive,/\.eq\('parish_id',parishId\)/);
 assert.match(archive,/\.eq\('note_type','decree_repetition'\)/);
 assert.match(archive,/repetitionEffects\.key===effectPageKey/);
 assert.match(archive,/Sin efectos por Repetición/);
 assert.match(archive,/Verificando notas/);
});
