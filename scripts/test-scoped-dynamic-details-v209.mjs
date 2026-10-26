import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const [name,path,entity] of [
 ['Bautismo','src/pages/BaptismDetailPage.jsx','record'],
 ['Decreto','src/pages/parish/ParishDecreeDetailPage.jsx','decree']
]){
 const src=fs.readFileSync(path,'utf8');
 test(`V209 ${name} hides prior entity when parish or route key changes`,()=>{
  assert.match(src,/const detailKey = `\$\{parishId \|\| ''\}:\$\{(?:decreeId|baptismPartidaId) \|\| ''\}`/);
  assert.match(src,/const \[loadedKey, setLoadedKey\] = useState\(null\)/);
  assert.match(src,/loadedKey === detailKey \? loaded(?:Decree|Record) : null/);
  assert.match(src,/const isPageLoading = loading \|\| loadedKey !== detailKey/);
  assert.ok(/if \(isPageLoading\)|\{isPageLoading \? \(/.test(src));
 });
 test(`V209 ${name} queries only by authenticated parish and given record ID`,()=>{
  assert.match(src,/\.eq\('parish_id', parishId\)/);
  assert.match(src,/\.eq\('id', (?:decreeId|baptismPartidaId)\)/);
  assert.ok(/if \(!active\) return|if \(active\)/.test(src));
  assert.match(src,/setLoadedKey\(detailKey\)/);
 });
}
