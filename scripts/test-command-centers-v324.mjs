import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {COMMAND_CENTERS,getCommandCenter} from '../src/config/commandCenters.js';
const read=p=>fs.readFileSync(p,'utf8');
const roles=['parish','diocese','chancery','admin_general'];
const app=read('src/App.jsx');
const allActions=role=>{const config=getCommandCenter(role);return [...config.modules.flatMap(item=>item.actions),...config.shortcuts,...config.followUp];};

test('V324 unknown or inherited role names expose no command center',()=>{
 for(const role of [undefined,null,'','anon','guest','toString','constructor','__proto__'])assert.equal(getCommandCenter(role),null);
 assert.deepEqual(Object.keys(COMMAND_CENTERS).sort(),roles.toSorted());
});
test('V324 every role launcher targets a real route authorized for that role',()=>{
 const constants={parish:'PARISH',diocese:'DIOCESE',chancery:'CHANCERY',admin_general:'ADMIN_GENERAL'};
 for(const role of roles)for(const action of allActions(role)){
  if(action.command){assert.equal(role,'chancery');assert.equal(action.command,'configureIdentity');continue;}
  assert.ok(action.to.startsWith('/')&&!action.to.startsWith('//'),action.to);
  const pathname=action.to.split('?')[0],route=app.split('\n').find(line=>line.includes('path="'+pathname+'"'));
  assert.ok(route,'Missing route '+pathname);
  if(route.includes('requiredRole='))assert.ok(route.includes('ROLE_TYPES.'+constants[role])||(role==='parish'&&route.includes('requiredRole="parish"')),role+' denied at '+pathname);
 }
});
test('V324 parish retains every existing sacramental action and every sidebar destination',()=>{
 const config=getCommandCenter('parish');
 assert.equal(config.modules.length,4);
 const destinations=new Set(allActions('parish').map(x=>x.to));destinations.add('/buscar');
 const sidebar=read('src/components/Sidebar.jsx');
 const block=sidebar.slice(sidebar.indexOf('// 3. PARROQUIA'),sidebar.indexOf('// 4. CANCILLERÍA'));
 for(const match of block.matchAll(/path: '([^']+)'/g)){
  if(match[1]==='/parish/dashboard')continue;
  assert.ok(destinations.has(match[1]),'Inaccessible from command center: '+match[1]);
 }
 assert.ok(destinations.has('/parroquia/matrimonio/expedientes'));
 assert.ok(destinations.has('/parroquia/confirmacion/notificacion'));
 assert.ok(destinations.has('/parroquia/matrimonio/notificacion'));
});
test('V324 bishops keep organization and reports; decree governance is confined to chancery',()=>{
 assert.ok(getCommandCenter('diocese').modules.some(x=>x.id==='organization'));
 assert.ok(getCommandCenter('diocese').modules.some(x=>x.id==='reports'));
 for(const action of allActions('diocese'))assert.doesNotMatch(action.to,/decret|chancery|\/admin/);
 for(const action of allActions('admin_general'))assert.doesNotMatch(action.to,/\/communications|\/parroquia|\/chancery/);
 for(const role of ['diocese','chancery','parish'])for(const action of allActions(role))if(action.to)assert.doesNotMatch(action.to,/^\/admin/);
});
test('V324 presentation adds no data writes, fake metrics, or authorization changes',()=>{
 const center=read('src/components/EcclesialCommandCenter.jsx'),config=read('src/config/commandCenters.js');
 for(const code of [center,config])assert.doesNotMatch(code,/supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
 assert.match(center,/metrics = \[\]/);
 assert.match(center,/loading \|\| error \? '—' : item.value/);
 assert.match(center,/if \(!config\) return null/);
 assert.match(read('src/pages/chancery/ChanceryDashboard.jsx'),/ChanceryDecreeSeatReceiptsV280\s*\/>/);
 assert.match(read('src/pages/admin/AdminGeneralDashboard.jsx'),/InstitutionalReadinessV274\s*\/>/);
});
test('V324 styles stay inside command centers and preserve print presentation',()=>{
 const css=read('src/styles/command-center.css');
 assert.match(css,/^\/\* V324/);
 assert.match(css,/@media screen/);
 assert.doesNotMatch(css,/@media print|^\s*(?:body|html|:root)\s*\{/gm);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(read('src/components/DashboardLayout.jsx'),/commandCenter && roleForPresentation === ROLE_TYPES.ADMIN_GENERAL/);
});
test('V324 small text and primary actions retain readable contrast on paper backgrounds',()=>{
 const css=read('src/styles/command-center.css');
 const luminosity=hex=>{
  const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 };
 const ratio=(a,b)=>{const values=[luminosity(a),luminosity(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
 for(const token of ['gold','muted','ink']){
  const value=css.match(new RegExp('--cc-'+token+': (#[a-f0-9]{6})'))?.[1];
  assert.ok(value,token);assert.ok(ratio(value,'#f8f5ef')>=4.5,token);
 }
 const mission=css.match(/\.cc-mission \{[^}]*color: (#[a-f0-9]{6})/)?.[1];
 assert.ok(mission);assert.ok(ratio(mission,'#f8f5ef')>=4.5);
 const wine=css.match(/--cc-wine: (#[a-f0-9]{6})/)?.[1];
 assert.ok(ratio(wine,'#ffffff')>=4.5);
});

test('V324 actual four dashboards pass responsive navigation, focus and read-only browser checks',()=>{
 const audit=JSON.parse(read('AUDITORIA_CENTROS_DE_MANDO_V324.json'));
 assert.equal(audit.protocol,'V324');assert.equal(audit.approved,true);
 assert.equal(audit.failed,0);assert.ok(audit.checked>=250);
 assert.ok(Object.keys(audit.source_sha256_lf).length>=14);
 for(const [file,expected]of Object.entries(audit.source_sha256_lf))
  assert.equal(createHash('sha256').update(read(file).replace(/\r\n/g,'\n')).digest('hex'),expected,file+' cambió después del ensayo');
 for(const role of roles)for(const viewport of ['desktop','small-desktop','tablet','mobile','small-mobile'])
  assert.ok(audit.checks.some(x=>x.name==='Sin desbordamiento horizontal'&&x.role===role&&x.viewport===viewport&&x.passed));
 assert.deepEqual(audit.exceptions,[]);assert.deepEqual(audit.externalRequests,[]);
 for(const role of roles){
  for(const viewport of ['desktop','mobile']){
   const screen=audit.screens.find(x=>x.role===role&&x.viewport===viewport);
   assert.ok(screen,role+'/'+viewport);
   assert.equal(screen.overflow,false);assert.equal(screen.writes,0);
   assert.ok(fs.existsSync('AUDITORIA_EVIDENCIA_CENTROS_V324/'+screen.file));
  }
 }
});
