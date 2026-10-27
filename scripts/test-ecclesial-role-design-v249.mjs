import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const layout=read('src/components/DashboardLayout.jsx');
const header=read('src/components/Header.jsx');
const sidebar=read('src/components/Sidebar.jsx');
const style=read('src/styles/ecclesial-workspace.css');
const routes=JSON.parse(read('AUDITORIA_RUTAS_ECLESIALES_V249.json'));
const inventory=JSON.parse(read('AUDITORIA_VISUAL_TRES_ROLES_V249.json'));

test('V249 only three institutional roles activate the ecclesial shell; Admin General remains unchanged',()=>{
 assert.match(layout,/ROLE_TYPES.DIOCESE,\s*ROLE_TYPES.CHANCERY,\s*ROLE_TYPES.PARISH/);
 assert.match(layout,/data-ecclesial-role=\{isEcclesialWorkspace \? roleForPresentation : undefined\}/);
 assert.match(layout,/isEcclesialWorkspace \? "ecclesial-workspace/);
 assert.match(layout,/: "min-h-screen bg-slate-50 flex flex-col"/);
 assert.doesNotMatch(layout,/isEcclesialWorkspace\s*=\s*true/);
});
test('V249 retains the actual Barranquilla crest without granting or modifying permission',()=>{
 assert.match(sidebar,/isBarranquillaInstitutionalUser\(user\)/);
 assert.match(sidebar,/BARRANQUILLA_CREST/);
 assert.match(sidebar,/isEcclesial && "ecclesial-sidebar"/);
 assert.match(sidebar,/ecclesial=\{isEcclesial\}/);
 assert.match(sidebar,/isEcclesial \? <Church/);
 assert.match(sidebar,/isEcclesial \? 'Áreas de servicio eclesial' : 'Centro de Operaciones'/);
});
test('V249 defines consistent responsive identity and an accessible user menu',()=>{
 assert.match(header,/ecclesial-header-mobile|ecclesial-mobile-brand/);
 assert.match(header,/aria-expanded=\{showUserMenu\}/);
 assert.match(header,/ecclesial-header-overline/);
 assert.match(header,/ecclesial-user-mark/);
 assert.match(style,/@media screen and \(max-width: 767px\)/);
 assert.match(style,/@media \(prefers-reduced-motion: reduce\)/);
});
test('V249 modernized presentation never applies a global print or admin background change',()=>{
 assert.ok(style.trim().startsWith('/*'));
 assert.match(style,/@media screen/);
 assert.doesNotMatch(style,/^\s*(?:body|html|:root)\s*\{/gm);
 assert.doesNotMatch(style,/@media print/);
 assert.doesNotMatch(style,/admin_general/);
 assert.match(read('src/index.css'),/@media print/);
});
test('V249 pastoral words and canonical styling in three actual role dashboards',()=>{
 const p=read('src/pages/parish/ParishDashboard.jsx');
 const d=read('src/pages/diocese/DioceseUserDashboard.jsx');
 const c=read('src/pages/chancery/ChanceryDashboard.jsx');
 assert.match(p,/ecclesial-parish-hero/);
 assert.match(p,/Vida parroquial y sacramentos/);
 assert.match(d,/ecclesial-scope-hero/);
 assert.match(d,/Vida y organización diocesana/);
 assert.match(c,/ecclesial-scope-hero/);
 assert.match(c,/Curia diocesana/);
 assert.doesNotMatch(c,/Mando Superior Diocesano/);
 assert.doesNotMatch(p,/Consola de Administración/);
});
test('V249 inventory includes ALL real protected routes by role while excluding admin from recoloring',()=>{
 assert.equal(routes.protocol,'V249');
 assert.ok(routes.counts.diocese>=7);
 assert.ok(routes.counts.chancery>=15);
 assert.ok(routes.counts.parish>=32);
 assert.ok(routes.counts.admin_general>=5);
 assert.equal(routes.admin_design_excluded,true);
 assert.ok(routes.total_unique_protected_paths>=55);
 for(const role of ['diocese','chancery','parish'])assert.ok(routes.role_paths[role].length>0);
});
test('V249 real Chrome audit uses isolated role mocks; it is not presented as actual account login',()=>{
 assert.equal(inventory.protocol,'V249');
 assert.match(inventory.method,/Chrome real/);
 assert.match(inventory.method,/mocks/);
 assert.equal(inventory.approved,true);
 assert.equal(inventory.failed,0);
 assert.equal(inventory.passed,inventory.checked);
 assert.ok(inventory.checked>=100);
 const roleSet=new Set(inventory.rows.map(x=>x.role));
 for(const role of ['diocese','chancery','parish','admin_general'])assert.ok(roleSet.has(role));
 const admin=inventory.rows.filter(x=>x.role==='admin_general');
 assert.ok(admin.every(x=>!x.ecclesial&&!x.header&&!x.sidebar));
 const professional=inventory.rows.filter(x=>x.role!=='admin_general');
 assert.ok(professional.every(x=>x.ecclesial&&x.header&&x.sidebar&&!x.overflow));
});
test('V249 visual automated checks mandatory in local master gate and GitHub workflow',()=>{
 for(const file of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(read(file),/scripts\/test-ecclesial-role-design-v249\.mjs/);
});
