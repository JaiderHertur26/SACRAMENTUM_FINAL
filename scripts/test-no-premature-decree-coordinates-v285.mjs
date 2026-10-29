import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = p => fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const pages=[
 ['src/pages/chancery/decree-correction/NewDecreeCorrectionPage.jsx','bautismo','correccion'],
 ['src/pages/chancery/decree-correction/NewConfirmationCorrectionPage.jsx','confirmacion','correccion'],
 ['src/pages/chancery/decree-replacement/NewDecreeReplacementPage.jsx','bautismo','reposicion'],
 ['src/pages/chancery/decree-replacement/NewConfirmationReplacementPage.jsx','confirmacion','reposicion'],
 ['src/pages/chancery/marriage/MarriageDecreesPage.jsx','matrimonio',null],
 ['src/pages/chancery/exequias/FuneralDecreesPage.jsx','exequias',null]
];
for(const [file,sacrament,type] of pages){
 test('V285 '+sacrament+' '+(type||'ambos')+' emite sin numeración prematura',()=>{
  const source=read(file);
  assert.match(source,/DecreeIssueRouteV285/);
  assert.match(source,new RegExp('sacrament="'+sacrament+'"'));
  if(type)assert.match(source,new RegExp('type="'+type+'"'));
  assert.doesNotMatch(source,/CanonicalSupplementaryPreview|supabase\.rpc\(|apply_.*_correction|apply_.*_replacement|create_.*_by_decree/);
 });
}
test('No existe la vista previa ni la leyenda que asigna al emitir',()=>{
 const primitives=read('src/components/chancery/CanonicalDecreePrimitives.jsx');
 const route=read('src/pages/chancery/DecreeIssueRouteV285.jsx');
 assert.doesNotMatch(primitives,/Próxima ubicación supletoria|CanonicalSupplementaryPreview|consume el consecutivo al emitir/);
 assert.doesNotMatch(route,/PreviewBox|p_expected_book|p_expected_folio|p_expected_number/);
});
test('El formulario V280 no pide las coordenadas de la nueva partida',()=>{
 const c=read('src/components/chancery/ChanceryDecreeIssueV280.jsx');
 assert.match(c,/initialSacrament/);
 assert.match(c,/initialType/);
 assert.match(c,/issueChanceryDecreeV280/);
 assert.doesNotMatch(c,/CanonicalSupplementaryPreview|Próxima ubicación supletoria|nextFolio|nextNumber/);
});
test('Servidor V280 crea decreto sin Libro Folio y Número',()=>{
 const issue=read('scripts/v280-issue-chancery-decree.sql');
 const seat=read('scripts/v280-seat-chancery-decree.sql');
 assert.match(issue,/'seatBook',null,'seatFolio',null,'seatNumber',null/);
 assert.match(issue,/'seatStatus','awaiting_parish'/);
 assert.match(seat,/UPDATE public\.decretos SET replacement_record_id=rec/);
 assert.match(seat,/'seatBook',code/);
 assert.match(seat,/notice\.status<>'read'/);
});
