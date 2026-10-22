import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261022161842_guard_stale_marriage_funeral_reversals_v135.sql');
const baseline=read('scripts/qa-rollback-stale-correction-reversal-baseline-v135.sql');
const changed=read('scripts/qa-rollback-stale-correction-reversal-postfix-v135.sql');
const original=read('scripts/qa-rollback-stale-original-correction-v135.sql');
const repos=read('scripts/qa-rollback-stale-reposition-reversal-v135.sql');
const baselineValidCorrection=read('scripts/qa-rollback-corrections-v115.sql');
const baselineValidRepo=read('scripts/qa-rollback-repositions-v115.sql');
const parts=(fn)=>{
 const start=migration.indexOf('CREATE OR REPLACE FUNCTION public.'+fn+'(');
 assert.ok(start>=0,'Missing '+fn);
 const end=migration.indexOf('$function$;',start);
 assert.ok(end>start);
 return migration.slice(start,end);
};
test('V135 conserva las firmas SECDEF de reversión matrimonial y de exequias',()=>{
 for(const name of ['reverse_marriage_decree','reverse_funeral_decree']){
  const ddl=parts(name);
  assert.match(ddl,/SECURITY DEFINER/);
  assert.match(ddl,/v_role <> 'chancery'/);
  assert.match(ddl,/v_user_diocese is distinct from v_decree.diocese_id/);
 }
});
test('V135 sólo revierte decretos activos o archivados',()=>{
 for(const name of ['reverse_marriage_decree','reverse_funeral_decree'])
  assert.match(parts(name),/v_decree.status,''\)\) not in \('active','archived'\)/);
});
test('V135 Matrimonio bloquea corrección si original o supletoria cambió',()=>{
 const ddl=parts('reverse_marriage_decree');
 assert.match(ddl,/v_original.status,''\)\) not in \('anulada','annulled'\)/);
 assert.match(ddl,/v_replacement.status,''\)\) <> 'seated'/);
 assert.match(ddl,/v_original.id = v_replacement.id/);
 assert.match(ddl,/v_original.parish_id is distinct from v_decree.parish_id/);
 assert.match(ddl,/v_replacement.parish_id is distinct from v_decree.parish_id/);
});
test('V135 Exequias bloquea corrección tardía sobre original y supletoria',()=>{
 const ddl=parts('reverse_funeral_decree');
 assert.match(ddl,/v_original.status,''\)\) not in \('anulada','annulled'\)/);
 assert.match(ddl,/v_replacement.status,''\)\) <> 'seated'/);
 assert.match(ddl,/v_original.id = v_replacement.id/);
 assert.match(ddl,/from public.funerals\s+where id=v_decree.original_record_id for update/);
});
test('V135 Matrimonio reposición debe conservar supletoria vigente y de su parroquia',()=>{
 const ddl=parts('reverse_marriage_decree');
 assert.match(ddl,/v_decree.original_record_id is not null/);
 assert.match(ddl,/La reposición matrimonial no tiene partida supletoria vigente y única/);
});
test('V135 Exequias reposición valida entidad y estado antes de escribir',()=>{
 const ddl=parts('reverse_funeral_decree');
 assert.match(ddl,/from public.funerals\s+where id=v_decree.replacement_record_id for update/);
 assert.match(ddl,/La partida supletoria de Exequias ya no está vigente o pertenece a otra parroquia/);
});
test('V135 reversión legítima preserva la escritura de notas y auditoría',()=>{
 for(const name of ['reverse_marriage_decree','reverse_funeral_decree']){
  const ddl=parts(name);
  assert.match(ddl,/insert into public.marginal_notes/i);
  assert.match(ddl,/insert into public.registry_audit_log/i);
  assert.match(ddl,/status\s*=\s*'reversed'/);
 }
});
test('V135 la prueba inicial reprodujo corrupción antes del parche',()=>{
 assert.match(baseline,/V135-CONFIRMED/);
 assert.match(baseline,/update public.marriages set status='nullified'/i);
 assert.match(baseline,/update public.funerals set status='reversed'/i);
});
test('V135 post-fix exige rechazar corrección si supletoria ya fue alterada',()=>{
 assert.match(changed,/EXCEPTION WHEN check_violation/);
 assert.match(changed,/v_new_st IS DISTINCT FROM 'nullified'/);
 assert.match(changed,/v_new_st IS DISTINCT FROM 'reversed'/);
 assert.match(changed,/v_st IS DISTINCT FROM 'anulada'/);
});
test('V135 post-fix exige rechazar corrección si original ya volvió a vigente',()=>{
 assert.match(original,/UPDATE public.marriages SET status='seated' WHERE id=v_original/);
 assert.match(original,/UPDATE public.funerals SET status='seated' WHERE id=v_original/);
 assert.match(original,/v_st IS DISTINCT FROM 'seated'/);
});
test('V135 reposición tardía no puede deshacer nueva decisión sobre supletoria',()=>{
 assert.match(repos,/UPDATE public.marriages SET status='nullified'/);
 assert.match(repos,/UPDATE public.funerals SET status='reversed'/);
 assert.match(repos,/EXCEPTION WHEN check_violation/);
 assert.match(repos,/SELECT count\(\*\) FROM public.marginal_notes/);
});
test('V115 mantiene trayecto válido de correcciones y de reposiciones',()=>{
 assert.match(baselineValidCorrection,/reverse_marriage_decree/);
 assert.match(baselineValidCorrection,/reverse_funeral_decree/);
 assert.match(baselineValidRepo,/create_marriage_reposition_by_decree/);
 assert.match(baselineValidRepo,/create_funeral_reposition_by_decree/);
});
for(const [name,sql]of [
 ['fallo reproducido',baseline],['supletoria alterada',changed],
 ['original alterada',original],['reposición alterada',repos],
 ['corrección legítima V115',baselineValidCorrection],['reposición legítima V115',baselineValidRepo]
]){
 test(name+' garantiza ROLLBACK y ausencia de COMMIT',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
