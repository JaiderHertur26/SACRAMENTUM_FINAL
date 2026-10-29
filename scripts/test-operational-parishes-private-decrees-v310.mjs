import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=p=>fs.readFileSync(p,'utf8');
const search=source('src/pages/UnifiedSearchPage.jsx');
const structure=source('src/services/ecclesiasticalStructureService.js');
const org=source('src/pages/diocese/DioceseEcclesiasticalPage.jsx');
const sidebar=source('src/components/Sidebar.jsx');
const app=source('src/App.jsx');
const sql=source('supabase/deployment/v310_decree_select_private_chancery_parish.sql');

test('V310 el buscador coincide con Organización: solo parroquias operativas',()=>{
 assert.match(structure,/\.from\('parishes'\)[\s\S]*?\.eq\('diocese_id', dioceseId\)\.eq\('is_operational', true\)/);
 assert.match(search,/\.from\('parishes'\)\s*\.select\('id, name, city, address, diocese_id, is_operational'\)\s*\.eq\('diocese_id', searchParams\.dioceseId\)\s*\.eq\('is_operational', true\)/);
 assert.match(search,/\.in\('id', Array\.from\(allFoundParishIds\)\)\.eq\('is_operational', true\)/);
 assert.match(search,/setFilteredParishes\(data \|\| \[\]\)/);
 assert.match(search,/if \(error\) throw error/);
});

test('V310 Diócesis sin contadores ni enlaces de decretos',()=>{
 assert.doesNotMatch(sidebar,/label: 'Supervisión de Decretos'/);
 assert.doesNotMatch(org,/listDecrees\s*\(/);
 assert.doesNotMatch(org,/counter\('byParish'|counter\('byDeanery'|counter\('byVicary'/);
 assert.doesNotMatch(org,/\/diocese\/decretos\/archivo/);
 assert.doesNotMatch(org,/>Decretos<\/th>/);
 const archivedPage=source('src/pages/diocese/DiocesanDecreeOversightPage.jsx');
 assert.match(app,/path="\/diocese\/decretos\/archivo"[^\n]+requiredRole=\{ROLE_TYPES\.DIOCESE\}/);
 assert.match(archivedPage,/export default function DiocesanDecreeOversightPage\(\) \{/);
 assert.match(archivedPage,/return <Navigate to="\/diocese\/dashboard" replace \/>;/);
});

test('V310 Cancillería y parroquia destino conservan archivo y rutas',()=>{
 assert.match(app,/path="\/chancery\/decretos\/archivo"[^\n]+requiredRole=\{ROLE_TYPES\.CHANCERY\}/);
 assert.match(app,/path="\/parroquia\/decretos\/archivo"[^\n]+requiredRole=\{ROLE_TYPES\.PARISH\}/);
 assert.match(sidebar,/label: 'Centro de Decretos', path: '\/chancery\/decretos'/);
 assert.match(sidebar,/label: 'Centro de Decretos', path: '\/parroquia\/decretos'/);
});

test('V310 RLS no hereda can_access_parish ni concede acceso a obispo o administrador',()=>{
 assert.match(sql,/DROP POLICY decretos_select_scope ON public\.decretos/);
 assert.match(sql,/CREATE POLICY decretos_select_scope ON public\.decretos\s+FOR SELECT TO authenticated/);
 assert.match(sql,/auth\.uid\(\) IS NOT NULL/);
 assert.match(sql,/public\.current_app_role\(\) = 'chancery'/);
 assert.match(sql,/diocese_id = public\.current_app_diocese_id\(\)/);
 assert.match(sql,/public\.current_app_role\(\) = 'parish'/);
 assert.match(sql,/parish_id = public\.current_app_parish_id\(\)/);
 assert.doesNotMatch(sql,/public\.can_access_parish\(parish_id\)/);
 assert.doesNotMatch(sql,/current_app_role\(\)\s*=\s*'diocese'/);
 assert.doesNotMatch(sql,/current_app_role\(\)\s*=\s*'admin_general'/);
 assert.doesNotMatch(sql,/DELETE FROM public\.decretos|UPDATE public\.decretos/i);
});
