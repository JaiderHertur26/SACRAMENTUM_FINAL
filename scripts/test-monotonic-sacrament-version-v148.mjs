import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(f)=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261022185717_monotonic_sacramental_record_version_v148.sql');
const baseline=read('scripts/qa-rollback-stale-record-version-baseline-v148.sql');
const valid=read('scripts/qa-rollback-monotonic-version-all-sacraments-v148.sql');
const print=read('supabase/migrations/20261022180645_guard_stale_registry_print_document_v143.sql');

test('V148 usa función de trigger privada que no acepta ejecución directa',()=>{
 assert.match(migration,/create or replace function private\.bump_sacramental_record_version_v148\(\)/);
 assert.match(migration,/returns trigger language plpgsql security invoker/);
 assert.match(migration,/revoke all on function private\.bump_sacramental_record_version_v148\(\) from public,anon,authenticated/);
});
test('V148 evita reutilizar timestamp en cambios dentro de la misma transacción',()=>{
 assert.match(migration,/clock_timestamp\(\)/);
 assert.match(migration,/old\.updated_at, '-infinity'::timestamptz\) \+ interval '1 microsecond'/);
 assert.match(migration,/greatest\(/);
});
test('V148 no altera las fechas históricas de partidas existentes por despliegue',()=>{
 assert.doesNotMatch(migration,/^\s*update public\.(baptisms|confirmations|marriages|funerals)\b/im);
 assert.doesNotMatch(migration,/^\s*alter table public\.(baptisms|confirmations|marriages|funerals)\b/im);
});
test('V148 mantiene la inserción histórica y solo incrementa versión en UPDATE',()=>{
 assert.match(migration,/if tg_op <> 'UPDATE' then\s*return new/);
 assert.equal((migration.match(/before update on public\./g)||[]).length,4);
});
for(const kind of ['baptisms','confirmations','marriages','funerals']){
 test('V148 instala un trigger tardío de versión en '+kind,()=>{
  assert.match(migration,new RegExp('drop trigger if exists zz_sacramentum_record_version_v148 on public\\.'+kind));
  assert.match(migration,new RegExp('before update on public\\.'+kind));
  assert.match(migration,new RegExp('on public\\.'+kind+'\\s+for each row execute function private\\.bump_sacramental_record_version_v148\\(\\)'));
 });
}
test('V148 trigger ejecuta después del trigger preexistente de fecha/normalización',()=>{
 assert.match(migration,/zz_sacramentum_record_version_v148/);
 assert.match(migration,/SET search_path/i);
});
test('V148 conserva seguridad al ejecutar dentro del esquema privado',()=>{
 assert.match(migration,/set search_path to 'pg_catalog', 'pg_temp'/);
 assert.doesNotMatch(migration,/security definer/i);
});
test('V148 QA original demuestra que una actualización de Bautismo NO avanzaba updated_at',()=>{
 assert.match(baseline,/V148-CONFIRMED: Baptism names changed but updated_at did not advance/);
 assert.match(baseline,/PERFORM pg_sleep/);
 assert.match(baseline,/RAISE EXCEPTION/);
});
test('V148 QA ejecuta el mismo flujo para los cuatro sacramentos',()=>{
 for(const t of ['bautismo','confirmacion','matrimonio','exequias'])assert.ok(valid.includes("'"+t+"'"),t);
 assert.match(valid,/FOREACH v_type/);
});
test('V148 QA comprueba dos actualizaciones estrictamente posteriores al INSERT',()=>{
 assert.match(valid,/v_original<v_first AND v_first<v_second/);
 assert.match(valid,/QA-V148-PRIMER-CAMBIO/);
 assert.match(valid,/QA-V148-SEGUNDO-CAMBIO/);
});
test('V148 QA verifica que no se puede forzar updated_at a una fecha antigua',()=>{
 assert.match(valid,/updated_at=\$2 WHERE id=\$3 RETURNING updated_at/);
 assert.match(valid,/2000-01-01/);
 assert.match(valid,/v_third<=v_second/);
});
test('V148 impresión niega la versión vieja en cada tipo, aunque coordenadas coincidan',()=>{
 assert.match(valid,/PERFORM public\.register_registry_print/);
 assert.match(valid,/V148-FAIL: % accepted old updated_at/);
 assert.match(valid,/EXCEPTION WHEN check_violation THEN v_denied:=v_denied\+1/);
});
test('V148 acepta nuevas impresiones usando únicamente la versión de partida vigente',()=>{
 assert.match(valid,/to_jsonb\(v_third::text\)/);
 assert.match(valid,/SELECT public\.register_registry_print/);
 assert.match(valid,/v_denied<>4 OR v_accepted<>4 OR v_markers<>4/);
});
test('V148 la comparación de versión de impresión V143 se conserva en el backend',()=>{
 assert.match(print,/v_record_updated_at is distinct from \(v_client_updated_at::timestamptz\)/);
 assert.match(print,/La partida fue modificada después de cargarse/);
});
for(const [name,sql] of [['forensic baseline',baseline],['positive regression',valid]]){
 test('V148 '+name+' es reversible sin modificar partidas históricas',()=>{
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
