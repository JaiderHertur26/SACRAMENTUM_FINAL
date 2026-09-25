import fs from 'node:fs';
import path from 'node:path';
import {
  LEGACY_IMPORT_PROFILES,
  normalizeLegacyFilename,
  detectLegacyProfile,
  analyzeLegacyRow
} from '../src/config/legacyImportProfiles.js';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
const check=(name,ok)=>{
  const pass=Boolean(ok);
  checks.push({name,pass});
  console.log(pass?'✓':'✗',name);
};

const sql=read('supabase/applied-history/SACRAMENTUM_LEGACY_MATRIMONIAL_NOTES_V17.sql');
const service=read('src/services/legacyMigrationService.js');
const page=read('src/pages/admin/LegacyMigrationCenterPage.jsx');
const panel=read('src/components/MarginalNotesRecordPanel.jsx');

check('MATRIMON(1).json normaliza a MATRIMON',
  normalizeLegacyFilename('MATRIMON(1).json')==='MATRIMON');
check('NTMAT002.json normaliza a NTMAT002',
  normalizeLegacyFilename('NTMAT002.json')==='NTMAT002');
check('Perfil NTMAT002 registrado en frontend',
  Boolean(LEGACY_IMPORT_PROFILES.NTMAT002));
check('Perfil NTMAT001 preparado',
  Boolean(LEGACY_IMPORT_PROFILES.NTMAT001));const sample={
  libro:'0001',
  folio:'0007',
  numero:'0013',
  nota:'ESTE MATRIMONIO FUE DECLARADO NULO POR SENTENCIA HISTÓRICA',
  dafe:'0004',
  actualizad:'2017-07-25T15:12:57'
};
check('Detección estructural NTMAT',
  detectLegacyProfile('archivo-renombrado.json',[sample])==='NTMAT002');

const analyzed=analyzeLegacyRow('NTMAT002',sample,0);
check('Nota NTMAT válida entra a staging',
  analyzed.status==='valid');
check('Texto NTMAT se conserva literal',
  analyzed.normalized_data.content===sample.nota);
check('Referencia matrimonial se conserva',
  analyzed.normalized_data.book_number==='0001'
  && analyzed.normalized_data.folio==='0007'
  && analyzed.normalized_data.number==='0013');
check('dafe se conserva',
  analyzed.normalized_data.legacy_dafe_code==='0004');
check('actualizad queda como metadato',
  analyzed.normalized_data.legacy_updated_at==='2017-07-25T15:12:57');
check('Clasificación no reemplaza texto',
  analyzed.normalized_data.classification==='nulidad_referida'
  && analyzed.normalized_data.content===sample.nota);check('SQL crea cola persistente',
  sql.includes('legacy_marginal_note_queue'));
check('SQL registra NTMAT001/NTMAT002',
  sql.includes("'NTMAT001'") && sql.includes("'NTMAT002'"));
check('SQL enlaza por Libro Folio Número',
  sql.includes('sacramentum_registry_ref(m.book_number)=q.book_number')
  && sql.includes('sacramentum_registry_ref(m.folio)=q.folio')
  && sql.includes('sacramentum_registry_ref(m.number)=q.number'));
check('SQL conserva pendientes sin partida',
  sql.includes("set status='pending'"));
check('SQL detecta referencias ambiguas',
  sql.includes("set status='ambiguous'"));
check('SQL no inventa note_date',
  sql.includes('historical_note_date_unknown')
  && sql.includes("q.content,")
  && sql.includes("v_marriage,")
  && sql.includes("null,")
  && sql.includes("'legacy_matrimonial_note'"));
check('SQL bloquea autoimpresión histórica',
  sql.includes("'internal'") && sql.includes('false') && sql.includes("'Nota histórica importada'"));
check('SQL conciliación idempotente',
  sql.includes('uq_legacy_matrimonial_note_source')
  && sql.includes("source_type='legacy_matrimonial_note'"));check('Servicio usa RPC especializado NTMAT',
  service.includes('apply_legacy_marginal_note_batch'));
check('Servicio reconcilia también después de MATRIMON',
  service.includes("['NTMAT001','NTMAT002','MATRIMON']"));
check('Centro muestra NTMAT',
  page.includes('NTMAT001/NTMAT002'));
check('Centro explica vínculo exacto',
  page.includes('Libro + Folio + Número'));
check('Centro muestra notas pendientes',
  page.includes('En espera de partida'));
check('Panel no presenta actualizad como fecha jurídica',
  panel.includes('fecha histórica de la nota no documentada'));

const failed=checks.filter(c=>!c.pass);
if(failed.length){
  console.error(`\nSACRAMENTUM V17 · FALLÓ · ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V17 · OK · ${checks.length}/${checks.length} controles.`);
