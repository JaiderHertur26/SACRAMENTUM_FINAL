import fs from 'node:fs';
import {
  normalizeLegacySex,
  normalizeLegacyUnionType,
  resolveLegacyPriestDisplay,
  resolveLegacyPriestValue
} from '../src/utils/legacyDisplayResolvers.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const checks = [];
const check = (label, value) => {
  const ok = Boolean(value);
  checks.push({ label, ok });
  console.log(`${ok ? '✓' : '✗'} ${label}`);
};

const profiles = read('src/config/legacyImportProfiles.js');
const resolver = read('src/utils/legacyDisplayResolvers.js');
const sacramentSvc = read('src/services/sacramentsService.js');
const marriageSvc = read('src/services/marriagesCloudService.js');
const funeralSvc = read('src/services/funeralService.js');
const confSeat = read('src/pages/parish/ConfirmationSentarRegistrosPage.jsx');
const baptismPrint = read('src/components/BaptismPrintTemplate.jsx');
const marriagePrint = read('src/components/MatrimonioPrintTemplate.jsx');
const migration = read('supabase/migrations/20260925183731_legacy_reference_resolution_v29.sql');

check('Sexo 1 -> MASCULINO', normalizeLegacySex('1') === 'MASCULINO');
check('Sexo 2 -> FEMENINO', normalizeLegacySex(2) === 'FEMENINO');
check('Unión 1 -> MATRIMONIO CATÓLICO', normalizeLegacyUnionType('1') === 'MATRIMONIO CATÓLICO');
check('Unión 2 -> MATRIMONIO CIVIL', normalizeLegacyUnionType(2) === 'MATRIMONIO CIVIL');
check('Unión 3 -> UNIÓN LIBRE', normalizeLegacyUnionType('3') === 'UNIÓN LIBRE');
check('Unión 4 -> MADRE SOLTERA', normalizeLegacyUnionType('4') === 'MADRE SOLTERA');
check('Unión 5 -> OTRO CASO', normalizeLegacyUnionType('5') === 'OTRO CASO');

const priest0001 = { nombre: 'PBRO. ROBERTO', apellido: 'PADILLA MARTÍNEZ', payload: { legacy_code: '0001' } };
check('Código 0001 resuelve nombre con una coincidencia', resolveLegacyPriestValue('0001', [priest0001]) === 'PBRO. ROBERTO PADILLA MARTÍNEZ');
check('Código sin catálogo conserva etiqueta explícita', resolveLegacyPriestValue('0005', []) === 'CÓDIGO LEGADO 0005 · NOMBRE NO CONSTA');
check('Código ambiguo no se resuelve', resolveLegacyPriestValue('0001', [priest0001, priest0001]) === 'CÓDIGO LEGADO 0001 · NOMBRE NO CONSTA');
check('Nombre canónico Supabase prevalece sin caché', resolveLegacyPriestDisplay({
  canonicalValue: 'PBRO. ROBERTO PADILLA MARTÍNEZ',
  code: '0001',
  parishId: 'parish-test',
  priests: []
}) === 'PBRO. ROBERTO PADILLA MARTÍNEZ');

check('Importación aplica normalización profunda', profiles.includes('normalizeLegacyCatalogCodesDeep(profile.normalize(raw,index))'));
check('Matrimonio contempla sexo de ambos contrayentes', profiles.includes('gender: sex(r.sexo1') && profiles.includes('gender: sex(r.sexo2'));
check('Exequias contempla sexo legado', profiles.includes("gender: sex(r.sexo || r.sex)"));

check('Resolver de sacerdote exige misma parroquia', migration.includes('where p.parish_id=p_parish_id'));
check('Resolver de sacerdote exige coincidencia única', migration.includes('if v_count=1'));
check('Código sin equivalencia no inventa nombre', migration.includes('CÓDIGO LEGADO ') && migration.includes('NOMBRE NO CONSTA'));
check('No se resuelve sacerdote por fecha', !/fecha_ingreso|fecha_salida/i.test(migration.split('sacramentum_resolve_legacy_priest_name')[1].split('$$;')[0]));

for (const table of ['baptisms','confirmations','marriages','funerals','pending_baptisms','pending_confirmations','pending_marriages','pending_funerals']) {
  check(`Trigger V29 presente: ${table}`, migration.includes(`trg_${table}_legacy_normalization_v29`));
}

check('Cambio en Párrocos refresca referencias históricas', migration.includes('trg_parrocos_refresh_legacy_references_v29'));
check('Backfill inicial incluido', migration.includes('sacramentum_refresh_legacy_reference_labels(null)'));
check('JSON original se conserva y se agrega legacy_resolved', migration.includes("'legacy_resolved'") && migration.includes("coalesce(p_raw,'{}'::jsonb) - 'legacy_resolved'"));

check('Nombre persistido en Supabase tiene prioridad sobre caché local', resolver.includes('const persistedName = humanPriestName(canonicalValue, resolvedValue)'));
check('Bautismo resuelve Da Fe y ministro con prioridad canónica', sacramentSvc.includes('resolveLegacyPriestDisplay') && sacramentSvc.includes('legacyDaFeCode'));
check('Confirmación resuelve Da Fe y ministro con prioridad canónica', sacramentSvc.includes('legacyMinisterCode') && sacramentSvc.includes('resolveLegacyPriestDisplay'));
check('Matrimonio hidrata legacy_normalized', marriageSvc.includes('legacy.party_1') && marriageSvc.includes('legacy.party_2'));
check('Matrimonio resuelve Da Fe', marriageSvc.includes('daFeDisplay') && marriageSvc.includes('resolveLegacyPriestDisplay'));
check('Exequias hidrata y resuelve códigos', funeralSvc.includes('hydrateFuneralRow') && funeralSvc.includes('resolveLegacyPriestDisplay'));
check('Sentar Confirmación usa purificador canónico', confSeat.includes('purificarRegistroConfirmacion'));
check('Partida Bautismo prioriza valor resuelto', baptismPrint.includes('data.daFe || data.da_fe || raw.legacy_resolved?.daFe'));
check('Partida Matrimonio usa campos normalizados', marriagePrint.includes('normalized}BaptismPlace'));

const failed = checks.filter((x) => !x.ok);
if (failed.length) {
  console.error(`\nV29 FALLÓ: ${failed.length}/${checks.length} controles.`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V29 · OK · ${checks.length}/${checks.length} controles.`);
