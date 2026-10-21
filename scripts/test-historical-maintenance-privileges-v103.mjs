import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261021215313_reserve_historical_reconciliation_to_service_v103.sql'),'utf8');
const names=['reconcile_maria_auxilio_baptisms_v65','reconcile_legacy_document_template_provenance_v68'];
function scan(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const full=path.join(dir,e.name);
  if(e.isDirectory())return scan(full);
  return /\.(js|jsx|mjs)$/.test(e.name)?[{path:full,content:fs.readFileSync(full,'utf8')}]:[];
 });
}
test('REVOCAR ambas funciones de reconciliación histórica',()=>{
 for(const n of names)assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.'+n+'()'));
});
test('No quedan permisos de EXECUTE para authenticated, anon o PUBLIC',()=>{
 assert.equal((sql.match(/FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*;/g)||[]).length,2);
});
test('Se conserva el mantenimiento por servicio y propietario',()=>{
 assert.doesNotMatch(sql,/^\s*REVOKE\b.*service_role/im);
 assert.doesNotMatch(sql,/^\s*DROP\s+(?:FUNCTION|OWNED)\b/im);
});
test('No se modifican registros históricos en la migración',()=>{
 assert.doesNotMatch(sql,/^\s*(?:UPDATE|INSERT|DELETE|TRUNCATE|ALTER\s+TABLE)\b/im);
});
test('Las pantallas actuales no invocan estas funciones',()=>{
 const hits=scan(path.join(root,'src')).filter(f=>names.some(n=>f.content.includes("'"+n+"'")||f.content.includes('"'+n+'"')));
 assert.deepEqual(hits.map(f=>path.relative(root,f.path)),[]);
});
test('Los verificadores históricos no dependen de estas RPC',()=>{
 const hits=scan(path.join(root,'scripts')).filter(f=>
  !f.path.endsWith('test-historical-maintenance-privileges-v103.mjs') &&
  names.some(n=>f.content.includes("'"+n+"'")||f.content.includes('"'+n+'"')));
 assert.deepEqual(hits.map(f=>path.relative(root,f.path)),[]);
});
