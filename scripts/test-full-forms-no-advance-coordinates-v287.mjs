import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const routes=[
 ['decree-correction/NewDecreeCorrectionPage.jsx','bautismo','correccion'],
 ['decree-correction/NewConfirmationCorrectionPage.jsx','confirmacion','correccion'],
 ['decree-replacement/NewDecreeReplacementPage.jsx','bautismo','reposicion'],
 ['decree-replacement/NewConfirmationReplacementPage.jsx','confirmacion','reposicion'],
 ['marriage/MarriageDecreesPage.jsx','matrimonio','correccion+reposicion'],
 ['exequias/FuneralDecreesPage.jsx','exequias','correccion+reposicion']
];
for(const [route,sacrament,type] of routes){
 test('V287 preserva formulario completo de '+sacrament+' '+type,()=>{
  const s=read('src/pages/chancery/'+route);
  assert.match(s,/CanonicalMasterPanel/);
  assert.match(s,/CanonicalField/);
  assert.match(s,/DecreeCenterHeader/);
  assert.match(s,/CanonicalDetail/);
  assert.match(s,/issueDecreeFromFullFormV287/);
  assert.doesNotMatch(s,/supabase\.rpc\(['"]apply_(?:baptism|confirmation)_(?:correction|replacement)['"]/);
  assert.doesNotMatch(s,/applyMarriageCorrectionDecree\s*\(\s*\{|createMarriageRepositionDecree\s*\(\s*\{/);
  assert.doesNotMatch(s,/applyFuneralCorrectionDecree\s*\(\s*\{|createFuneralRepositionByDecree\s*\(\s*\{/);
  assert.match(s,/book_number|Libro/);
  assert.match(s,/folio/);
 });
}
test('V287 no muestra la ubicación de la nueva partida antes del asiento',()=>{
 const s=read('src/components/chancery/CanonicalDecreePrimitives.jsx');
 assert.match(s,/CanonicalSupplementaryPreview\s*=\s*\(\)\s*=>\s*null/);
 assert.doesNotMatch(s,/Próxima ubicación supletoria|consume el consecutivo al emitir/);
});
test('V287 emite solo memoria pendiente en Supabase',()=>{
 const s=read('scripts/v287-issue-from-full-legacy-form-without-coordinates.sql');
 assert.match(s,/INSERT INTO public\.%I\(id,parish_id,status,reportado,raw_data\)/);
 assert.match(s,/issue_chancery_decree_v280/);
 assert.match(s,/seatBook',null|'book',null/);
 assert.match(s,/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated/);
 assert.match(s,/noPhysicalCoordinatesAssigned/);
 assert.doesNotMatch(s,/INSERT INTO public\.baptisms|UPDATE public\.baptisms|UPDATE public\.confirmations|UPDATE public\.marriages|UPDATE public\.funerals/);
});
test('V287 el servicio no envía coordenadas en la llamada RPC',()=>{
 const s=read('src/services/issueDecreeFromFullFormV287.js');
 assert.match(s,/supabase\.rpc\('issue_chancery_form_decree_v294'/);
 assert.match(s,/delete record\[key\]/);
 assert.match(s,/data\?\.book!=null\|\|data\?\.folio!=null\|\|data\?\.number!=null/);
});
