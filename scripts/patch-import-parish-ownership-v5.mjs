import fs from 'node:fs';

const cfg='src/config/legacyImportProfiles.js';
let c=fs.readFileSync(cfg,'utf8');
c=c.replace(/requiresParish:\s*false/g,'requiresParish: true');
fs.writeFileSync(cfg,c);

const page='src/pages/admin/LegacyMigrationCenterPage.jsx';
let p=fs.readFileSync(page,'utf8');
p=p.replace("  const isHistoricalBallot = ['INSBAUTI','INSCONFI'].includes(profileKey);\n  const allowParishSelection = Boolean(importProfile?.requiresParish || isHistoricalBallot);","  const isHistoricalBallot = ['INSBAUTI','INSCONFI'].includes(profileKey);\n  const allowParishSelection = true;");
p=p.replace("      if (!p.requiresParish) setParishId('');\n",'');
p=p.replace("    if (importProfile?.requiresParish && !parishId) { setError('Selecciona la parroquia destino para esta estructura.'); return; }","    if (!parishId) { setError('Selecciona la parroquia propietaria. Toda importación debe quedar ligada a una parroquia.'); return; }");
p=p.replace('Parroquia destino','Parroquia propietaria · obligatoria');
p=p.replace("{importProfile?.requiresParish?'Seleccione parroquia…':isHistoricalBallot?'Opcional · parroquia de custodia / conciliación':'No requerida para este catálogo'}","Seleccione la parroquia propietaria…");
fs.writeFileSync(page,p);
console.log('PATCH_IMPORT_PARISH_OWNERSHIP_V5_OK');
const svc='src/services/legacyMigrationService.js';
let s=fs.readFileSync(svc,'utf8');
s=s.replace("export async function createLegacyBatch({ filename, profileKey, hash, sourceName, parishId = null, dioceseId = null, metadata = {} }) {\n  const { data, error } = await supabase.rpc('create_legacy_import_batch', {","export async function createLegacyBatch({ filename, profileKey, hash, sourceName, parishId = null, dioceseId = null, metadata = {} }) {\n  if (!parishId) throw new Error('Toda importación histórica debe quedar ligada a una parroquia propietaria.');\n  const { data, error } = await supabase.rpc('create_legacy_import_batch', {");
fs.writeFileSync(svc,s);
console.log('SERVICE_PARISH_GUARD_V5_OK');