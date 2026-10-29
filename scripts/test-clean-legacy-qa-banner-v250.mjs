import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {isTestRegistryData,testDocumentPrintCss,stampTestPdfPages} from '../src/utils/testDocumentStamp.mjs';
import {isKnownTestRegistryProject} from '../src/utils/registryDataMode.mjs';
import {jsPDF} from 'jspdf';

const root=path.resolve('src');
const lines=[];
const extensions=new Set(['.jsx','.tsx','.js','.ts','.mjs','.css']);
function scan(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,ent.name);
  if(ent.isDirectory())scan(full);
  else if(extensions.has(path.extname(full)))lines.push([path.relative(root,full),fs.readFileSync(full,'utf8')]);
 }
}
scan(root);
const oldA=['DATOS','DE','PRUEBA'].join(' ');
const oldB=['NO','OFICIALES'].join(' ');
test('V250 source UI and generated-document code contain no legacy notice',()=>{
 for(const [name,s] of lines){
  assert.equal(s.toUpperCase().includes(oldA),false,name);
  assert.equal(s.toUpperCase().includes(oldB),false,name);
 }
});
test('V250 login and all dashboards no longer mount QA alert ribbons',()=>{
 const login=fs.readFileSync('src/pages/PublicSearchPage.jsx','utf8');
 const dash=fs.readFileSync('src/components/DashboardLayout.jsx','utf8');
 assert.doesNotMatch(login,/isKnownTestRegistryProject|role="status" className="mt-4/);
 assert.doesNotMatch(dash,/usingTestRecords|role="status" aria-label=/);
 assert.match(dash,/ecclesial-workspace/);
});
test('V299 elimina estampas repetitivas sin activar el modo oficial',()=>{
 assert.equal(isTestRegistryData(),true);
 assert.equal(testDocumentPrintCss(),'');
 const doc=new jsPDF();
 assert.strictEqual(stampTestPdfPages(doc),doc);
 const content=doc.internal.pages.slice(1).join('\n');
 assert.doesNotMatch(content,/COPIA DE REVISIÓN|NO APTO PARA EXPEDICIÓN/);
});
test('V250 QA database protection remains independent from presentation',()=>{
 assert.equal(isKnownTestRegistryProject('https://foczofcmwampjvlfbsqn.supabase.co'),true);
 const guard=fs.readFileSync('guard-official-build-v223.mjs','utf8');
 assert.match(guard,/assessOfficialBuild/);
 const core=fs.readFileSync('release-guard-core-v223.mjs','utf8');
 assert.match(core,/isKnownTestRegistryProject|KNOWN_QA_PROJECT_REFS|KNOWN_QA/i);
 const auth=fs.readFileSync('src/lib/authz.js','utf8');
 assert.match(auth,/ROLE_TYPES|role/i);
});
test('V250 checks run in GitHub Actions and quality suite',()=>{
 for(const p of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml']){
  assert.match(fs.readFileSync(p,'utf8'),/scripts\/test-clean-legacy-qa-banner-v250\.mjs/);
 }
});
