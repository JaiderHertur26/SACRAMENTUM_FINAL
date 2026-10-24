// SACRAMENTUM V183 — Barrera de secretos en artefactos entregables.
// No imprime tokens, credenciales ni contenido sensible: sólo nombres de controles.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const BAD_ENV_NAME = /(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD|DATABASE_URL|DIRECT_URL|DB_URL|ACCESS_TOKEN|API_SECRET|POSTGRES_URL|JWT_SIGNING)/i;
const BAD_PUBLIC_NAME = /^(?:VITE_|REACT_APP_|NEXT_PUBLIC_).*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD|DATABASE_URL|DIRECT_URL|DB_URL|ACCESS_TOKEN|API_SECRET|POSTGRES_URL|JWT_SIGNING)/i;
const DANGEROUS_LITERAL = [
  {code:'supabase-secret-prefix', regex:/\bsb_secret_[A-Za-z0-9_-]{12,}/},
  {code:'privileged-api-token', regex:/\bsk_(?:live|test)_[A-Za-z0-9_-]{18,}/},
  {code:'private-key-block', regex:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/},
  {code:'postgres-connection-string', regex:/postgres(?:ql)?:\/\/[^\s"'<>]{10,}/i}
];
const WEB_EXT = new Set(['.html','.js','.mjs','.css','.json','.svg','.txt','.map','.webmanifest','.xml']);
export function parseEnv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value=value.slice(1,-1);
    rows.push({name:m[1],value});
  }
  return rows;
}
export function jwtPrivilegeMarkers(text) {
  const found = [];
  const re = /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/g;
  for (const match of text.matchAll(re)) {
    try {
      const body = match[0].split('.')[1];
      const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
      if (payload?.role === 'service_role' || payload?.role === 'supabase_admin') found.push('privileged-jwt');
    } catch { /* invalid/non-JWT text */ }
  }
  return found;
}
function* traverse(root) {
  for (const entry of fs.readdirSync(root,{withFileTypes:true})) {
    const file=path.join(root,entry.name);
    if (entry.isDirectory()) yield* traverse(file);
    else if (entry.isFile()) yield file;
  }
}
export function scanBuild({buildDir,envFiles=[],trackedFiles=[]}) {
  const violations=[], files=[];
  if (!fs.existsSync(buildDir)) throw new Error('No existe la carpeta de compilación');
  for (const file of traverse(buildDir)) {
    files.push(file);
    const data=fs.readFileSync(file);
    if (!WEB_EXT.has(path.extname(file).toLowerCase()) && data.length>15_000_000) continue;
    const text=data.toString('utf8');
    for (const detector of DANGEROUS_LITERAL) {
      if (detector.regex.test(text)) violations.push({code:detector.code,file:path.relative(buildDir,file)});
    }
    for (const code of jwtPrivilegeMarkers(text)) violations.push({code,file:path.relative(buildDir,file)});
  }
  const publicEnvNames=[];
  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) continue;
    for (const {name,value} of parseEnv(fs.readFileSync(envFile,'utf8'))) {
      if (BAD_PUBLIC_NAME.test(name)) violations.push({code:'public-privileged-env-name',file:path.basename(envFile)});
      if (name.startsWith('VITE_')) publicEnvNames.push(name);
      if (BAD_ENV_NAME.test(name) && value.length>=16) {
        for (const file of files) {
          // Equality check uses bytes in memory; never log value.
          if (fs.readFileSync(file).includes(Buffer.from(value,'utf8'))) {
            violations.push({code:'private-env-value-embedded',file:path.relative(buildDir,file)});
          }
        }
      }
    }
  }
  for (const tracked of trackedFiles) {
    const normalized=tracked.replace(/\\/g,'/');
    if (/(?:^|\/)\.env(?:\..*)?$/i.test(normalized) && !normalized.endsWith('.env.example')) {
      violations.push({code:'tracked-environment-file',file:normalized});
    }
  }
  return {passed:violations.length===0,filesChecked:files.length,environmentFilesChecked:envFiles.filter(fs.existsSync).length,publicEnvironmentNames:publicEnvNames.length,violations};
}
export function run(root=process.cwd()) {
  const tracked=execFileSync('git',['ls-files','--cached'],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
  const envFiles=['.env','.env.local','.env.production','.env.production.local','.env.development','.env.development.local'].map(f=>path.join(root,f));
  return scanBuild({buildDir:path.join(root,'dist'),envFiles,trackedFiles:tracked});
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result=run();
    console.log('V183 SECRETS '+(result.passed?'PASS':'FAIL')+'; archivos='+result.filesChecked+'; envs='+result.environmentFilesChecked+'; hallazgos='+result.violations.length);
    for (const v of result.violations) console.error('BLOQUEO '+v.code+' en '+v.file);
    if (!result.passed) process.exitCode=1;
  } catch(error) {
    console.error('BLOQUEO V183: '+error.message);
    process.exitCode=1;
  }
}
