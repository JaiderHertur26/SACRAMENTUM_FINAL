import fs from 'node:fs';
const s=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');
const checks={
  historicalBallot:s.includes("['INSBAUTI','INSCONFI'].includes(profileKey)"),
  selectorEnabled:s.includes('disabled={!allowParishSelection}'),
  requiredOwnership:s.includes('Parroquia propietaria') && s.includes('obligatoria'),
  allBallots:s.includes('Importar todas las boletas')
};
console.log(JSON.stringify(checks,null,2));
if(Object.values(checks).some(v=>!v)) process.exit(2);