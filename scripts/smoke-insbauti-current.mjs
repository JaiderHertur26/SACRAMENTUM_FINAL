import fs from 'node:fs';
import { analyzeLegacyRow, detectLegacyProfile } from '../src/config/legacyImportProfiles.js';
const j=JSON.parse(fs.readFileSync('C:/SACRAMENTUM/_legacy_sources_private/20260915/INSBAUTI.json','utf8'));
const rows=Array.isArray(j)?j:(j.data||[]);
const profile=detectLegacyProfile('INSBAUTI(3).json',rows);
const analysis=rows.map((row,index)=>analyzeLegacyRow(profile,row,index));
console.log(JSON.stringify({
  profile,
  total:analysis.length,
  valid:analysis.filter(x=>x.status==='valid').length,
  review:analysis.filter(x=>x.status==='review').length,
  reported:analysis.filter(x=>x.normalized_data.reported===true).length,
  notReported:analysis.filter(x=>x.normalized_data.reported===false).length,
  issueCodes:[...new Set(analysis.flatMap(x=>x.issue_codes))]
},null,2));
