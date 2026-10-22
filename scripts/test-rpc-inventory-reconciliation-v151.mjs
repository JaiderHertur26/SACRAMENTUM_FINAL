import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const db=read('AUDITORIA_RPC_CATALOGO_DB_V151.json');
const inv=read('AUDITORIA_RPC_PRIVILEGIADAS_V151.json');
const prior=read('AUDITORIA_RPC_PRIVILEGIADAS_V150.json');
test('V151 catálogo contiene todas las 200 SECURITY DEFINER de public y private',()=>{
 assert.equal(db.functions.length,200);
 assert.equal(inv.total_security_definer,200);
 assert.deepEqual(inv.by_schema,{public:191,private:9});
});
test('V151 distingue 139 funciones authenticated ejecutables y 61 no directas',()=>{
 assert.equal(inv.authenticated_directly_executable,139);
 assert.equal(inv.not_directly_executable_by_authenticated,61);
 assert.equal(inv.anon_executable,0);
});
test('V151 136 RPC públicas siguen en el inventario V150 sin desapariciones',()=>{
 const names=new Set(prior.functions.map(x=>x.function_name));
 const pub=inv.functions.filter(x=>x.schema==='public'&&x.directly_executable_by_authenticated);
 assert.equal(pub.length,136);
 assert.equal(names.size,136);
 for(const x of pub)assert.ok(names.has(x.function_name),x.function_name);
});
test('V151 detecta exactamente tres SECURITY DEFINER privadas ejecutables por authenticated',()=>{
 const p=inv.functions.filter(x=>x.schema==='private'&&x.directly_executable_by_authenticated);
 assert.deepEqual(p.map(x=>x.function_name).sort(),[
 'attach_decree_concept_policy_internal',
 'materialize_pending_legacy_marriages',
 'materialize_pending_legacy_sacramental_records'
 ]);
});
test('V151 marca dos materializadores parcialmente revisados sin certificar función restante',()=>{
 const m=inv.functions.filter(x=>x.schema==='private'&&x.review_status==='PARTIAL_TESTED_MIGRATION_ROLE_MATRIX_V151');
 assert.equal(m.length,2);
 assert.ok(m.every(x=>x.test_evidence.length===3));
 assert.equal(inv.partially_tested,24);
 assert.equal(inv.pending_direct_authorization_review,115);
});
test('V151 conserva evidencias del V150 de 22 funciones públicas',()=>{
 for(const x of prior.functions.filter(f=>f.review_status.startsWith('PARTIAL_TESTED'))){
  const newer=inv.functions.find(y=>y.schema==='public'&&y.function_name===x.function_name&&y.directly_executable_by_authenticated);
  assert.ok(newer,x.function_name);
  assert.equal(newer.review_status,x.review_status);
  for(const e of x.test_evidence)assert.ok(newer.test_evidence.includes(e));
 }
});
test('V151 las 61 funciones privadas/públicas sin EXECUTE directo no se consideran seguras automáticamente',()=>{
 const x=inv.functions.filter(f=>!f.directly_executable_by_authenticated);
 assert.equal(x.length,61);
 assert.ok(x.every(f=>f.review_status==='NOT_DIRECT_EXECUTABLE_INTERNAL_CALL_PATH_REVIEW_PENDING'));
});
test('V151 no atribuye permisos de sobrecarga vigente a una firma revocada',()=>{
 const f=inv.functions.filter(x=>x.schema==='public'&&x.function_name==='review_marriage_nullity_execution_v128');
 assert.equal(f.length,2);
 assert.equal(f.filter(x=>x.directly_executable_by_authenticated).length,1);
 assert.equal(f.filter(x=>!x.directly_executable_by_authenticated&&x.review_status==='NOT_DIRECT_EXECUTABLE_INTERNAL_CALL_PATH_REVIEW_PENDING').length,1);
});
test('V151 inventario es de metadatos, no contiene contraseñas ni JWT',()=>{
 const txt=fs.readFileSync('AUDITORIA_RPC_CATALOGO_DB_V151.json','utf8');
 assert.doesNotMatch(txt,/authorization\s*:\s*bearer|service_role_key|eyJhbGciOi/);
});
