import fs from 'node:fs';
import { LEGACY_IMPORT_PROFILES } from '../src/config/legacyImportProfiles.js';
const failures=[];
const withoutParish=Object.entries(LEGACY_IMPORT_PROFILES).filter(([,p])=>!p.requiresParish).map(([k])=>k);
if(withoutParish.length) failures.push(`Perfiles sin parroquia obligatoria: ${withoutParish.join(', ')}`);
const page=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');
const svc=fs.readFileSync('src/services/legacyMigrationService.js','utf8');
if(!page.includes('Parroquia propietaria · obligatoria')) failures.push('UI no rotula parroquia propietaria obligatoria');
if(!page.includes("if (!parishId)")) failures.push('UI no bloquea staging sin parroquia');
if(!svc.includes('Toda importación histórica debe quedar ligada a una parroquia propietaria')) failures.push('Servicio no bloquea lote sin parroquia');
if(failures.length){console.error(failures.join('\n'));process.exit(2)}
console.log(`OK · ${Object.keys(LEGACY_IMPORT_PROFILES).length} perfiles exigen parroquia propietaria.`);