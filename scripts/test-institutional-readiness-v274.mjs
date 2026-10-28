import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('scripts/staged-v267-fresh-zero-rpc-cutover.sql');
const ci=read('scripts/ci-fresh-official-start-v267.sh');
test('V274 denies duplicate Auth identity and wrong role scope before any privileged GRANT',()=>{
 for(const x of [
 'V274: una cuenta Auth no puede activar múltiples perfiles',
 'GROUP BY up.auth_user_id HAVING count(*)>1',
 "lower(up.role)='parish'",
 'p.is_operational IS DISTINCT FROM TRUE',
 'p.diocese_id IS DISTINCT FROM up.diocese_id',
 "lower(up.role)='chancery'",
 'c.diocese_id IS DISTINCT FROM up.diocese_id',
 "lower(up.role)='diocese'",
 "lower(up.role)='admin_general'",
 'V274: jurisdicción o rol activo inválido'
 ])assert.ok(sql.includes(x),x);
 const preflight=sql.indexOf('V274: una cuenta Auth no puede activar múltiples perfiles');
 const grant=sql.indexOf('GRANT EXECUTE ON FUNCTION public.seat_baptism_ledger_v263');
 assert.ok(preflight>0&&preflight<grant);
});
test('V274 PostgreSQL fixture reproduces real scoped parish and chancery with independent negative checks',()=>{
 const fixture=read('scripts/fixture-fresh-zero-v267.mjs');
 assert.ok(fixture.includes('chancery_id uuid,is_operational boolean DEFAULT true'));
 assert.ok(fixture.includes('INSERT INTO public.chancelleries'));
 for(const a of [
 'one GoTrue identity bound to two active institutional roles',
 'active parish on an inactive parish must deny official launch',
 'active chancery without verified chancery scope must deny',
 'UPDATE public.parishes SET is_operational=true',
 'SET chancery_id=',
 'DELETE FROM public.user_profiles WHERE role=\'admin_general\''
 ])assert.ok(ci.includes(a),a);
});
test('V274 admin preview is read-only and never confuses client visible counts with server readiness',()=>{
 const page=read('src/pages/admin/AdminGeneralDashboard.jsx');
 const ui=read('src/components/InstitutionalReadinessV274.jsx');
 assert.match(page,/InstitutionalReadinessV274/);
 assert.match(ui,/is_active===true/);
 assert.match(ui,/!x.auth_user_id/);
 assert.match(ui,/String\(x.status\).toUpperCase\(\)==='ACTIVE'/);
 for(const term of ['políticas de acceso','no certifica','No se generan cuentas ficticias','No crea usuarios'])assert.ok(ui.includes(term),term);
 assert.doesNotMatch(ui,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|supabase\.rpc\(/);
 assert.ok(read('.github/workflows/sacramentum-auditoria-v90.yml').includes('test-institutional-readiness-v274.mjs'));
});

test('V274 operator-facing identity inventory is read-only and contains no personally identifying contact fields',()=>{
 const s=read('scripts/read-only-v274-identity-jurisdiction-review.sql');
 for(const token of ['LEFT JOIN auth.users','LEFT JOIN public.parishes','SIN_IDENTIDAD_AUTH',
  'CUENTA_AUTH_INEXISTENTE','PARROQUIA_O_DIOCESIS_NO_COINCIDE',
  'CUENTA_AUTH_DUPLICADA','VERIFICAR_TITULAR_REAL_Y_VINCULAR_O_DESACTIVAR'])
  assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/\\b(UPDATE|DELETE FROM|TRUNCATE|INSERT INTO|ALTER TABLE|GRANT EXECUTE)\\b/i);
 assert.doesNotMatch(s,/up\\.(email|full_name|phone|username)/i);
});
