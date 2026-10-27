import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import { assessOfficialBuild } from './release-guard-core-v223.mjs';

const env = loadEnv('production',process.cwd(),'VITE_');
const mode = process.env.VITE_REGISTRY_DATA_MODE ?? env.VITE_REGISTRY_DATA_MODE;
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
let report=null;
const reportPath = process.env.SACRAMENTUM_RELEASE_ATTESTATION_PATH;
if (reportPath) {
 try {
   const resolved=path.resolve(reportPath);
   report=JSON.parse(fs.readFileSync(resolved,'utf8'));
 } catch {
   console.error('V230: No fue posible leer el acta de publicación autorizada.');
   process.exit(1);
 }
}
const check=assessOfficialBuild({mode,supabaseUrl,report});
if (!check.ok) {
 console.error('V230 BLOQUEO DE PUBLICACIÓN OFICIAL:');
 for (const reason of check.problems) console.error(' - '+reason);
 process.exit(1);
}
console.log(check.mode==='test'
 ? 'V230: publicación en modo de datos de PRUEBA; no se autoriza validez oficial.'
 : 'V230: puerta documental de publicación oficial satisfecha; exige verificación independiente de base.');
