import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecreeTerritory, matchesDecreeTerritory} from '../src/utils/decreeTerritory.mjs';

const read = path => fs.readFileSync(path,'utf8');
const edit = read('src/components/modals/EditParishModal.jsx');
const details = read('src/components/modals/ParishDetailsModal.jsx');
const structure = read('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
const service = read('src/services/ecclesiasticalStructureService.js');
const activate = read('supabase/functions/activate-environment/index.ts');

test('V305C permite editar parroquia adscrita directamente a vicaria, sin decanato', () => {
 assert.match(edit, /if \(!formData\.vicaryId\)/);
 assert.doesNotMatch(edit, /if \(!formData\.vicaryId \|\| !formData\.deaneryId\)/);
 assert.match(edit,/Decanato \(opcional\)/);
 assert.match(edit,/Sin decanato · directamente adscrita a la Vicaría/);
 assert.match(edit,/deaneryId: formData\.deaneryId/);
 assert.match(service,/decanate_id: clean\(deaneryId\)/);
 assert.match(service,/\.eq\('diocese_id', dioceseId\)/);
});

test('V305C rechaza vicaria inexistente y decanato de otra vicaria',() => {
 assert.match(edit,/!vicaries\.some\(v => String\(v\.id\) === String\(formData\.vicaryId\)\)/);
 assert.match(edit,/formData\.deaneryId && !availableDeaneries\.some/);
 assert.match(edit,/String\(d\.vicaria_id \|\| d\.vicaryId \|\| ''\) === String\(formData\.vicaryId \|\| ''\)/);
 assert.match(edit,/vicaryId: value, deaneryId: ''/);
});

test('V305C organizacion reconoce parroquias sin decanato aunque exista antigua referencia legacy', () => {
 assert.match(structure,/const parishDeanery = p\.decanate_id \|\| p\.decanateId;/);
 assert.match(structure,/p\.decanate_id \|\| p\.decanateId\) === normalizedId\(deaneryId\)/);
 assert.match(structure,/Parroquias directamente adscritas a la Vicaría/);
 assert.match(details,/Adscripción directa a la Vicaría \(sin decanato\)/);
 assert.doesNotMatch(details,/decanateId \|\| parish\.deanery_id/);
});

test('V306 autoriza nuevas parroquias sin decanato después de desplegar Edge Function', () => {
 assert.match(activate,/if \(!verifiedVicaryId\)/);
 assert.match(structure,/type === 'PARISH' && !envFormData\.vicaryId/);
 assert.match(structure,/disabled=\{!realVicaries\.length\}/);
});

test('V305C contadores siguen jurisdiccion territorial actual, sin mover ni duplicar decretos',()=>{
 const vicaries=[{id:'v',name:'Vicaría'}];
 const deaneries=[{id:'d',vicaria_id:'v'}];
 const rows=[{id:'z',parish_id:'p'}];
 const before=buildDecreeTerritory(rows,[{id:'p',vicary_id:'v',decanate_id:'d'}],vicaries,deaneries);
 const after=buildDecreeTerritory(rows,[{id:'p',vicary_id:'v',decanate_id:null,deanery_id:'legacy'}],vicaries,deaneries);
 assert.equal(before.byDeanery.d,1);
 assert.equal(after.byDeanery.d||0,0);
 assert.equal(before.byVicary.v,1);
 assert.equal(after.byVicary.v,1);
 assert.equal(after.byParish.p,1);
 assert.equal(after.total,1);
 assert.equal(matchesDecreeTerritory(rows[0],after,{vicaryId:'v',parishId:'p'}),true);
});
