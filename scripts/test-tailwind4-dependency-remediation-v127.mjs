import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
const css=read('src/index.css');
const postcss=read('postcss.config.js');
const admin=read('src/pages/admin/AdminGeneralDashboard.jsx');
const diocese=read('src/pages/diocese/DioceseUserDashboard.jsx');
const CI=read('.github/workflows/sacramentum-auditoria-v90.yml');
const gate=read('scripts/audit-gate-v90.mjs');
test('Tailwind usa versión 4 y procesador PostCSS explícito',()=>{
 assert.match(pkg.devDependencies.tailwindcss,/^\^?4\./);
 assert.match(pkg.devDependencies['@tailwindcss/postcss'],/^\^?4\./);
 assert.match(postcss,/'@tailwindcss\/postcss'/);
 assert.doesNotMatch(postcss,/^\s*tailwindcss:\s*\{/m);
});
test('CSS nuevo conserva la configuración eclesial y las capas de Tailwind 4',()=>{
 assert.match(css,/@import "tailwindcss";/);
 assert.match(css,/@config "\.\.\/tailwind.config.js";/);
 assert.match(css,/@layer base/);
 assert.match(css,/@layer components/);
});
test('No existe braces vulnerable ni micromatch/chokidar de Tailwind 3 en el lockfile',()=>{
 const packages=Object.keys(lock.packages||{});
 for(const affected of ['node_modules/braces','node_modules/chokidar','node_modules/fast-glob','node_modules/micromatch']){
  assert.ok(!packages.includes(affected),'Still bundled '+affected);
 }
});
test('Paneles de Diócesis y Admin General usan transparencias Tailwind 4 sin clase obsoleta',()=>{
 assert.match(admin,/bg-blue-600\/10/);
 assert.match(diocese,/bg-\[#f5e8db\]/);
 assert.match(diocese,/ecclesial-scope-hero/);
 assert.doesNotMatch(admin,/bg-opacity-10/);
 assert.doesNotMatch(diocese,/bg-opacity-10/);
});
test('CI exige auditoría de producción y auditoría completa',()=>{
 assert.match(CI,/npm audit --omit=dev --audit-level=low/);
 assert.match(CI,/npm audit --audit-level=low/);
});
test('Puerta local completa no acepta vulnerabilidades ni ausencia de auditoría',()=>{
 assert.match(gate,/dependencias-produccion/);
 assert.match(gate,/dependencias-completas/);
 assert.match(gate,/findingCounts\.total===0/);
});
test('La verificación de utilidades CSS usa paquete directo declarado',()=>{
 assert.ok(pkg.devDependencies['postcss-selector-parser']);
 assert.match(read('scripts/check-critical-css-v91.mjs'),/ecclesial-workspace/);
 assert.match(read('scripts/check-critical-css-v91.mjs'),/postcss-selector-parser/);
});
