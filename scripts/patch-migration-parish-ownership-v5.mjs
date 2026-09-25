import fs from 'node:fs';
const file='src/pages/admin/LegacyMigrationCenterPage.jsx';
let s=fs.readFileSync(file,'utf8');
s=s.replace("  const isHistoricalBallot = ['INSBAUTI','INSCONFI'].includes(profileKey);\n  const allowParishSelection = Boolean(importProfile?.requiresParish || isHistoricalBallot);","  const isHistoricalBallot = ['INSBAUTI','INSCONFI'].includes(profileKey);\n  const allowParishSelection = true;");
s=s.replace("      .then(([p])=>setParishes(p || []))","      .then(([p])=>{ const list=p || []; setParishes(list); if(list.length===1) setParishId(list[0].id); })");
s=s.replace("      const p = LEGACY_IMPORT_PROFILES[chosen];\n      if (!p.requiresParish) setParishId('');","      const p = LEGACY_IMPORT_PROFILES[chosen];");
s=s.replace("    if (importProfile?.requiresParish && !parishId) { setError('Selecciona la parroquia destino para esta estructura.'); return; }","    if (!parishId) { setError('Selecciona la parroquia propietaria. Toda importación debe quedar ligada a una parroquia operativa.'); return; }");
fs.writeFileSync(file,s);
console.log('PATCH_MIGRATION_PARISH_OWNERSHIP_V5_A_OK');