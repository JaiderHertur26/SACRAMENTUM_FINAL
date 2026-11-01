import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ESLint} from 'eslint';
import modern, {minimatch as named,Minimatch} from 'minimatch';
const require=createRequire(import.meta.url),legacy=require('minimatch');

test('El motor ejecutado es minimatch oficial 11.0.1, con versión e integridad fijadas',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const engine=JSON.parse(fs.readFileSync('node_modules/@sacramentum/minimatch-engine/package.json','utf8'));
 const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
 assert.equal(engine.name,'minimatch');assert.equal(engine.version,'11.0.1');
 assert.equal(pkg.devDependencies['@sacramentum/minimatch-engine'],'npm:minimatch@11.0.1');
 assert.equal(lock.packages['node_modules/@sacramentum/minimatch-engine'].version,'11.0.1');
 assert.ok(lock.packages['node_modules/@sacramentum/minimatch-engine'].integrity.startsWith('sha512-'));
 assert.equal(pkg.overrides.minimatch,'$minimatch');
});

test('Las interfaces CommonJS, ESM y Minimatch conservan el reconocimiento de rutas',()=>{
 assert.equal(typeof legacy,'function');
 for(const match of [legacy,modern,named]){
  assert.equal(match('src/a.jsx','src/**/*.{js,jsx}'),true);
  assert.equal(match('src/a.ts','src/**/*.{js,jsx}'),false);
  assert.equal(match('src/.hidden.js','src/*.js',{dot:true}),true);
  assert.equal(match('A.JS','*.js',{nocase:true}),true);
 }
 assert.equal(new Minimatch('src/**').match('src/a.jsx'),true);
 assert.equal(legacy.defaults({nocase:true})('A.JS','*.js'),true);
 assert.deepEqual(legacy.match(['a.js','b.ts'],'*.js'),['a.js']);
});

test('Todos los consumidores de ESLint y sus plugins resuelven el adaptador al motor corregido',()=>{
 for(const consumer of ['eslint','eslint-plugin-react','eslint-plugin-import','@eslint/eslintrc']){
  const use=createRequire(require.resolve(consumer));
  const match=use('minimatch');
  assert.equal(typeof match,'function');
  assert.equal(match,legacy);
  assert.equal(new match.Minimatch('src/**').match('src/a.jsx'),true);
  assert.equal(match('component.jsx','*.jsx'),true);
 }
});

test('La configuración real detecta una variable inexistente dentro de JSX',async()=>{
 const eslint=new ESLint({cwd:process.cwd(),overrideConfigFile:path.resolve('eslint.config.mjs')});
 const [bad]=await eslint.lintText('export const Example=()=> <div>{missingValue}</div>;',{filePath:'src/__v323_bad__.jsx'});
 assert.ok(bad.messages.some(x=>x.ruleId==='no-undef'&&x.severity===2));
});

test('La configuración real conserva las reglas de hooks y acepta JSX válido',async()=>{
 const eslint=new ESLint({cwd:process.cwd(),overrideConfigFile:path.resolve('eslint.config.mjs')});
 const [bad]=await eslint.lintText('function lower(){ React.useState(0); }',{filePath:'src/__v323_hooks__.jsx'});
 assert.ok(bad.messages.some(x=>x.ruleId==='react-hooks/rules-of-hooks'));
 const [good]=await eslint.lintText('export default function Example(){ return <div>Listo</div>; }',{filePath:'src/__v323_good__.jsx'});
 assert.equal(good.errorCount,0,JSON.stringify(good.messages));
 assert.equal(await eslint.isPathIgnored('dist/__v323_ignored__.js'),true);
});
