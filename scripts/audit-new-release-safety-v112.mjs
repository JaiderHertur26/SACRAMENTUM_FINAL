import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const master=JSON.parse(read('AUDITORIA_MAESTRA_CONTROLES_V90.json'));
const gate=JSON.parse(read('AUDITORIA_PUERTA_CALIDAD_V112.json'));
const counts={};const phases={};
for(const c of master.controls){
 counts[c.status]=(counts[c.status]||0)+1;
 (phases[c.phase]??={name:c.area,priority:c.priority,counts:{}}).counts[c.status]=((phases[c.phase].counts[c.status]||0)+1);
}
const js=fs.readdirSync(path.join(root,'dist','assets')).filter(x=>x.endsWith('.js'))
 .map(f=>read(path.join('dist','assets',f)));
const built=js.join('\n');
const envPath=path.join(root,'.env.local');
const credentials=[];
if(fs.existsSync(envPath)){
 for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)$/);
  if(!m)continue;
  const name=m[1],val=m[2].trim().replace(/^(["'])(.*)\1$/,'$2');
  if(/(SERVICE_ROLE|SECRET|PRIVATE_KEY|JWT|DATABASE_PASSWORD|DB_PASSWORD|ACCESS_TOKEN)/i.test(name)){
   credentials.push({name,exposedInVitePrefix:name.startsWith('VITE_'),embeddedInCompiledJs:val.length>=15&&built.includes(val)});
  }
 }
}
const migrationNames=['20261022023010_court_receipt_dual_control_assessment_v111.sql','20261022023434_court_clarification_workflow_v112.sql'];
const migrations=migrationNames.map(name=>({name,present:fs.existsSync(path.join(root,'supabase','migrations',name))}));
const scan={protocol:'V112',timestamp:new Date().toISOString(),readOnly:true,
 controlCount:master.controls.length,phaseCount:Object.keys(phases).length,
 counts,phases,
 syntheticAndBuild:{passed:gate.passed,total:gate.checks,failed:gate.failed,dependencySecurityIncluded:gate.strictDependencies},
 migrationSources:migrations,
 bundle:{jsAssetCount:js.length,serviceRoleLiteralFound:built.includes('sb_secret_'),knownSecretValuesFound:credentials.filter(c=>c.embeddedInCompiledJs||c.exposedInVitePrefix).map(c=>c.name)},
 secretKeyNamesOnly:credentials.map(c=>c.name),
 knownDependencyRisk:{source:'scripts/V104_NPM_AUDIT.json',fiveHighNotYetRemediated:true},
 limitations:['No autenticacion real de todas las pantallas','No restauracion comprobada de backup','No certificacion canonica automatica','Prueba de dependencias de este gate omitida']};
fs.writeFileSync(path.join(root,'AUDITORIA_SEGURIDAD_Y_ESTADO_V112.json'),JSON.stringify(scan,null,2)+'\n');
console.log('Controles: '+scan.controlCount+' / Fases: '+scan.phaseCount);
console.log('Estado: '+JSON.stringify(counts));
console.log('Puerta sin auditoria externa: '+gate.passed+'/'+gate.checks);
console.log('Migraciones fuente V111 y V112: '+migrations.every(x=>x.present));
console.log('Credenciales privadas embebidas por cotejo con .env.local: '+credentials.filter(x=>x.embeddedInCompiledJs).length);
console.log('VITE_ con nombre sensible: '+credentials.filter(x=>x.exposedInVitePrefix).length);
