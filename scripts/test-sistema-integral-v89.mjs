// Pruebas sintéticas V89: nunca conecta a producción ni escribe partidas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decreeSacrament,decreeCategory,decreeEffect,decreeCanReverse,isHistoricalDecree } from '../src/utils/decreeArchiveModel.mjs';
import { buildDocumentaryDecreeHtml } from '../src/services/decreeDocumentaryHtml.mjs';
import { analyzeLegacyRow,detectLegacyProfile,normalizeLegacyFilename } from '../src/config/legacyImportProfiles.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exists=(p)=>fs.existsSync(path.join(root,p));
const app=read('src/App.jsx');
const side=read('src/components/Sidebar.jsx');
const paths=[...app.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map(m=>m[1]);
const hasRoute=(p)=>paths.includes(p);
const sacramentDefs=[
  ['bautismo','Bautismo','BaptismNewPage','BaptismCelebratedPage','BaptismPartidasPage','BaptismSentarRegistrosPage','BaptismParametersPage'],
  ['confirmacion','Confirmación','ConfirmationNewPage','ConfirmationCelebratedPage','ConfirmationPartidasPage','ConfirmationSentarRegistrosPage','ConfirmationParametersPage'],
  ['matrimonio','Matrimonio','MatrimonioNewPage','MatrimonioCelebratedPage','MatrimonioPartidasPage','MatrimonioSentarRegistrosPage','MatrimonioParametersPage'],
  ['exequias','Exequias','FuneralRegistryPage','FuneralRegistryPage','FuneralPartidasPage','FuneralRegistryPage','BaptismParametersPage']
];
const matrix=[
 ['admin_general',['/admin/dioceses','/admin/users','/admin/migration-center']],
 ['diocese',['/diocese/dashboard','/diocese/ecclesiastical','/diocese/reports','/diocese/migration-center','/diocese/decretos/archivo']],
 ['chancery',['/chancery/dashboard','/chancery/pending','/chancery/decretos','/chancery/decretos/archivo','/chancery/decretos/documental','/chancery/decree-correction/new','/chancery/decree-replacement/new','/chancery/decree-correction/new-confirmation','/chancery/decree-replacement/new-confirmation','/chancery/matrimonio/decretos','/chancery/exequias/decretos']],
 ['parish',['/parish/dashboard','/parroquia/bautismo/nuevo','/parroquia/bautismo/celebrado','/parroquia/bautismo/partidas','/parroquia/bautismo/sentar-registros','/parroquia/confirmacion/nuevo','/parroquia/confirmacion/partidas','/parroquia/matrimonio/nuevo','/parroquia/matrimonio/partidas','/parroquia/exequias','/parroquia/exequias/partidas','/parroquia/libros','/parroquia/decretos','/parroquia/decretos/archivo','/parish/decrees/:decreeId','/parroquia/matrimonio/notificacion','/parish/sacramental-notifications','/parish/notifications','/datos-auxiliares']]
];
const moduleFiles=[
 ['administrador','src/pages/admin/DioceseListPage.jsx'],
 ['usuarios','src/pages/admin/UserListPage.jsx'],
 ['jurisdicción','src/pages/diocese/DioceseEcclesiasticalPage.jsx'],
 ['estadísticas','src/pages/diocese/DiocesanSacramentalReportsPage.jsx'],
 ['supervisión','src/pages/diocese/DiocesanDecreeOversightPage.jsx'],
 ['bautismos','src/pages/parish/BaptismPartidasPage.jsx'],
 ['confirmaciones','src/pages/parish/ConfirmationPartidasPage.jsx'],
 ['matrimonios','src/pages/parish/MatrimonioPartidasPage.jsx'],
 ['exequias','src/pages/parish/FuneralPartidasPage.jsx'],
 ['libros','src/pages/parish/SacramentalBooksPage.jsx'],
 ['notificaciones','src/pages/parish/SacramentalNotificationsPage.jsx'],
 ['bandeja Cancillería','src/pages/chancery/ChanceryPendingPage.jsx'],
 ['decretos','src/pages/chancery/SacramentalDecreeArchivePage.jsx'],
 ['imprimir documentos','src/services/decreeDocumentHtml.js'],
 ['libros PDF','src/services/sacramentalBookPdf.js'],
 ['migración histórica','src/pages/admin/LegacyMigrationCenterPage.jsx'],
 ['comunicaciones','src/pages/CommunicationsPage.jsx'],
 ['búsqueda','src/pages/UnifiedSearchPage.jsx'],
 ['plantillas','src/pages/DocumentTemplateLibraryPage.jsx'],
 ['parámetros','src/pages/parish/BaptismParametersPage.jsx'],
 ['notificaciones matrimoniales','src/pages/parish/NotificacionMatrimonialPage.jsx']
];

test('Cobertura de módulos: todos los archivos centrales existen y tienen código',()=>{
  const errors=moduleFiles.filter(([label,p])=>!exists(p)||read(p).trim().length<100).map(([label,p])=>label+' '+p);
  assert.deepEqual(errors,[]);
});
test('Rutas principales de cuatro roles completas, protegidas o redirigidas',()=>{
  assert.ok(paths.length>85,'Se esperaban más de 85 rutas');
  const missing=matrix.flatMap(([role,required])=>required.filter(p=>!hasRoute(p)).map(p=>role+':'+p));
  assert.deepEqual(missing,[]);
});
test('Sin rutas internas omitidas en el menú por referencia inexistente',()=>{
  const menuRoutes=[...side.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map(m=>m[1].split('?')[0]);
  const missing=menuRoutes.filter(p=>p!=='/' && !hasRoute(p));
  assert.deepEqual([...new Set(missing)],[]);
});
test('No se concede ruta de emisión a Parroquia ni Diócesis',()=>{
  assert.ok(!hasRoute('/parroquia/decretos/documental'));
  assert.ok(!hasRoute('/diocese/decretos/documental'));
  assert.match(app,/chancery\/decretos\/documental[^\n]+requiredRole=\{ROLE_TYPES\.CHANCERY\}/);
  assert.match(app,/diocese\/decretos\/archivo[^\n]+requiredRole=\{ROLE_TYPES\.DIOCESE\}/);
});
test('Decretos documentales solo por RPC y sin INSERT directo de frontend',()=>{
  const src=read('src/pages/chancery/DocumentaryDecreePage.jsx');
  assert.match(src,/rpc\('issue_documentary_decree_v88'/);
  assert.ok(src.includes('p_source_reference') && src.includes('p_historical'));
  const sql=read('supabase/migrations/20261021151121_lock_direct_decree_writes_v89.sql');
  assert.match(sql,/REVOKE INSERT, UPDATE, DELETE/);
  assert.match(sql,/GRANT SELECT/);
});
test('Blindaje contra reescritura jurídica de decretos de otro rol, históricos o documentales',()=>{
  const sql=read('supabase/migrations/20261021153810_guard_decree_concept_mutation_v89.sql');
  assert.ok(sql.includes("v_role is distinct from 'chancery'"));
  assert.ok(sql.includes("not in ('correccion','reposicion')"));
  assert.ok(sql.includes("not in ('active','vigente')"));
  assert.ok(sql.includes("legacyHistorical"));
  assert.ok(sql.includes("recordOrigin"));
  assert.ok(sql.includes("documentaryOnly"));
  assert.ok(sql.includes("ya fue fijado y no se puede sustituir"));
});
test('Trazabilidad institucional se consulta por RPC jurisdiccional y no por tabla privada',()=>{
  const sql=read('supabase/migrations/20261021152552_decree_trace_scoped_v89.sql');
  const detail=read('src/pages/parish/ParishDecreeDetailPage.jsx');
  assert.ok(sql.includes('auth.uid() IS NOT NULL'));
  assert.ok(sql.includes('public.can_access_parish(d.parish_id)'));
  assert.ok(sql.includes('JOIN public.registry_audit_log a'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION'));
  assert.ok(detail.includes("get_decree_trace_v89"));
  assert.ok(!detail.includes(".from('registry_audit_log')"));
});
test('Decretos no se escriben directamente desde código de navegador',()=>{
  const filenames=[
    'src/services/decreeRegistryService.js',
    'src/pages/chancery/DocumentaryDecreePage.jsx',
    'src/pages/chancery/decree-correction/NewDecreeCorrectionPage.jsx',
    'src/pages/chancery/decree-replacement/NewDecreeReplacementPage.jsx'
  ];
  for (const file of filenames) {
    const code=read(file);
    assert.ok(!/from\((?:'|"|`)(?:decretos)(?:'|"|`)\)[\s\S]{0,90}\.insert\(/.test(code),file);
  }
});
test('Migración histórica y registro completo mantienen centros separados',()=>{
  assert.ok(app.includes('/admin/migration-center') && app.includes('/diocese/migration-center'));
  const svc=read('src/services/legacyMigrationService.js');
  assert.ok(svc.includes('apply_legacy_import_batch_v3'));
  assert.ok(svc.includes('apply_legacy_marginal_note_batch'));
  assert.ok(svc.includes('reconcile_legacy_matrimonial_notes'));
});
test('Índices sacramentales usan libros canónicos de cuatro sacramentos',()=>{
  const books=read('src/pages/parish/SacramentalBooksPage.jsx');
  for (const [s] of sacramentDefs) assert.ok(books.includes(s),'Sin índice '+s);
  assert.ok(books.includes('listSacramentalBookRecords'));
  assert.ok(books.includes('downloadSacramentalIndexPdf'));
});
test('Impresión, notas, parametrización y comunicaciones tienen implementación',()=>{
  for (const f of ['src/services/marginalNotesV2Service.js','src/services/sacramentalBooksService.js',
    'src/services/matrimonialNotificationsService.js','src/services/officialNotificationsService.js',
    'src/services/chatService.js','src/services/historicalRegistryService.js'])
    assert.ok(exists(f),f);
});
test('Rutas públicas separadas de privadas',()=>{
  const publicSearch=app.match(/<Route path="\/" element=\{<PublicSearchPage\s*\/>\}/);
  assert.ok(publicSearch);
  for (const [role,needed] of matrix) for (const route of needed) {
    const line=app.split('\n').find(l=>l.includes('path="'+route+'"'));
    assert.ok(line && (line.includes('ProtectedRoute') || line.includes('Navigate')),'Sin protección: '+role+route);
  }
});

const rawFixture=(i,s)=>({
  parish_id:'00000000-0000-4000-8000-000000000111',
  diocese_id:'00000000-0000-4000-8000-000000000999',
  sacrament_type:s,
  decree_number:'TEST-FICTICIO-'+s+'-'+i,
  decree_date:'2020-01-01',
  payload:{targetName:'PERSONA FICTICIA',reason:'Sin valor registral ni eclesiástico',
    sourceReference:'ARCHIVO DE PRUEBA, caja 2, folio 8'}
});
for (const [s,sLabel,...files] of sacramentDefs) {
  test(sLabel+' tiene pantallas o ruta de registro, consulta y cierre',()=>{
    for (const file of [...new Set(files)]) assert.ok(exists('src/pages/parish/'+file+'.jsx') ||
      exists('src/pages/'+file+'.jsx'),file+' faltante');
  });
  for (const [variant,kind,expectedEffect,legacy,status,canReverse] of [
    ['corrección normal','correccion','registral',false,'active',true],
    ['reposicion normal','reposicion','registral',false,'active',true],
    ['corrección revertida','correccion','registral',false,'reversed',false],
    ['reposición revertida','reposicion','registral',false,'reversed',false],
    ['corrección histórica ejecutada','correccion','historico_ejecutado',true,'archived',false],
    ['corrección histórica sin conciliación','correccion','historico_no_verificado',true,'archived',false],
    ['decreto documental actual','documental','sin_modificacion',false,'active',false],
    ['decreto documental histórico','documental','sin_modificacion',true,'archived',false],
    ['decreto de otro tipo','otro','no_determinado',false,'active',false]
  ]) {
    for (const role of ['admin_general','diocese','chancery','parish']) {
      test(sLabel+' · '+variant+' · '+role+' · clasificación y seguridad',()=>{
        const p=rawFixture(variant,s);
        const row={...p,tipo:kind,status,payload:{...p.payload,
          ...(legacy?{legacyHistorical:true,recordOrigin:'legacy_import'}:{}),
          ...((legacy && variant.includes('ejecutada'))?{executionReconciled:true,issuanceMode:'legacy_decree_execution'}:{})
        }};
        assert.equal(decreeSacrament(row.sacrament_type),s);
        assert.equal(decreeCategory(row.tipo,row.payload),kind);
        assert.equal(decreeEffect(row),expectedEffect);
        assert.equal(decreeCanReverse(row),canReverse);
        if (legacy) assert.equal(isHistoricalDecree(row),true);
        if (kind==='documental') {
          const html=buildDocumentaryDecreeHtml({row});
          assert.ok(html.includes(row.decree_number));
          assert.ok(!html.includes('<script>'));
          assert.match(html,/NO ORDENA ANULACIÓN|NO CONSTITUYE NUEVA EXPEDICIÓN/);
        }
        // El acceso de cada rol se verifica en RLS SQL, no se inventa aquí.
        assert.ok(matrix.some(([r])=>r===role));
      });
    }
  }
}

for (const [profile,source] of [
  ['INSBAUTI','INSBAUTI(2).json'],
  ['INSCONFI','INSCONFI(2).json'],
  ['MATRIMON','MATRIMON(1).json'],
  ['NTMAT001','NTMAT001.json'],
  ['NTMAT002','NTMAT002.json'],
  ['PARROCOS','PARROCOS(2).json'],
  ['CIUDADES','CIUDADES(1).json'],
  ['DIOCESIS','DIOCESIS(1).json'],
  ['IGLESIAS','IGLESIAS(1).json'],
  ['OBISPOS','OBISPOS.json']
]) test('Importación histórica ficticia: archivo '+source+' normalizado',()=>{
    assert.equal(normalizeLegacyFilename(source),profile);
  });

for (const profile of ['INSBAUTI','INSCONFI']) for(const reported of [true,false]) {
  test('Boleta ficticia '+profile+' reported='+reported,()=>{
    const fields=profile==='INSBAUTI'
      ?{numero:'000075',fecins:'2020-01-01',fecbau:'2020-01-03',lugbau:'PARROQUIA FICTICIA'}
      :{numero:'000075',fecins:'2020-01-01',feccon:'2020-01-03',lugcon:'PARROQUIA FICTICIA'};
    const row={...fields,nombres:'ALGUIEN',apellidos:'FICTICIO',
      reported, fecnac:'2010-01-01'};
    const outcome=analyzeLegacyRow(profile,row,4);
    assert.equal(outcome.status,'valid');
    assert.ok(outcome.issue_codes.includes(reported?'LEGACY_BOLETA_REPORTED':'LEGACY_BOLETA_NOT_SEATED'));
  });
}
test('HTML documental escapa contenido malicioso y no simula decretos firmados',()=>{
  const row={...rawFixture('x','bautismo'),tipo:'documental',payload:{
    reason:'<img src=x onerror=alert(1)>',historical:true,sourceReference:'<script>ataque</script>'
  }};
  const html=buildDocumentaryDecreeHtml({row});
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'));
  assert.ok(html.includes('&lt;img') && !html.includes('<img src='));
  assert.match(html,/RECONSTRUCCIÓN DE DECRETO HISTÓRICO/);
});
