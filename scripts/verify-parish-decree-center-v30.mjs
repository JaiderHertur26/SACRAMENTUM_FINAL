import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const checks = [];
const check = (label, condition) => {
  const ok = Boolean(condition);
  checks.push({ label, ok });
  console.log(`${ok ? '✓' : '✗'} ${label}`);
};

const app = read('src/App.jsx');
const sidebar = read('src/components/Sidebar.jsx');
const header = read('src/components/chancery/DecreeCenterHeader.jsx');
const parishCenter = read('src/pages/parish/ParishSacramentalDecreesCenterPage.jsx');
const parishArchive = read('src/pages/parish/ParishSacramentalDecreeArchivePage.jsx');
const chanceryCenter = read('src/pages/chancery/SacramentalDecreesCenterPage.jsx');
const service = read('src/services/decreeRegistryService.js');
const parishNotifications = read('src/pages/parish/ParishNotificationsPage.jsx');
const parishDetail = read('src/pages/parish/ParishDecreeDetailPage.jsx');
const migration = read('supabase/migrations/20260925191903_parish_decree_center_v30.sql');

check('Parroquia tiene Centro de Decretos', app.includes('path="/parroquia/decretos"') && app.includes('ParishSacramentalDecreesCenterPage'));
check('Parroquia tiene Archivo unificado', app.includes('path="/parroquia/decretos/archivo"') && app.includes('ParishSacramentalDecreeArchivePage'));
check('Sidebar parroquial entra al Centro', sidebar.includes("path: '/parroquia/decretos'"));
check('Rutas antiguas Corrección redirigen al Centro', app.includes('/parroquia/decretos/archivo?type=correccion&sacrament=bautismo'));
check('Rutas antiguas Reposición redirigen al Centro', app.includes('/parroquia/decretos/archivo?type=reposicion&sacrament=bautismo'));
check('Confirmación antigua redirige a espacio de Confirmación', app.includes('/parroquia/decretos/archivo?type=correccion&sacrament=confirmacion'));
check('Página parroquial antigua de Corrección Bautismo retirada', !fs.existsSync('src/pages/parish/BaptismCorrectionListPage.jsx'));
check('Página parroquial antigua de Reposición Bautismo retirada', !fs.existsSync('src/pages/parish/BaptismRepositionListPage.jsx'));
check('Página parroquial antigua de Corrección Confirmación retirada', !fs.existsSync('src/pages/parish/ConfirmationCorrectionListPage.jsx'));

for (const sacrament of ['bautismo','confirmacion','matrimonio','exequias']) {
  check(`Lenguaje compartido incluye ${sacrament}`, header.includes(`${sacrament}:`) && parishCenter.includes('DECREE_SACRAMENT_META'));
}
for (const operation of ['correction','reposition','archive']) {
  check(`Operación compartida ${operation}`, header.includes(`${operation}:`) && parishCenter.includes('DECREE_OPERATION_META') && chanceryCenter.includes('DECREE_OPERATION_META'));
}

check('Corrección usa definición canónica de partida original anulada', header.includes('la original queda anulada') && header.includes('partida supletoria vinculada'));
check('Reposición usa definición canónica sin partida utilizable', header.includes('No existe una partida utilizable') && header.includes('fundamento documental suficiente'));
check('Parroquia declara que no emite ni revierte', parishCenter.includes('La Parroquia recibe y consulta') && parishArchive.includes('no emitir ni revertir decretos'));
check('Cancillería conserva emisión y reversión', chanceryCenter.includes('reversión auditada'));
check('Nulidad matrimonial permanece fuera de Corrección/Reposición', chanceryCenter.includes('Tribunal Eclesiástico'));

check('Archivo parroquial filtra por parishId', parishArchive.includes('parishIds: [user.parishId]'));
check('Archivo parroquial filtra por sacramento', parishArchive.includes('sacramentType: sacrament'));
check('Archivo parroquial filtra por tipo', parishArchive.includes("type: typeFilter === 'all' ? null : typeFilter"));
check('Archivo parroquial abre detalle institucional', parishArchive.includes('/parish/decrees/${row.id}'));
check('Servicio de decretos importa cliente Supabase', service.includes("import { supabase } from '@/lib/supabaseClient'"));
check('Servicio hidrata tipo y sacramento canónicos', service.includes('normalizeDecreeType') && service.includes('normalizeSacramentType'));
check('Bandeja parroquial elimina lenguaje ODC', !parishNotifications.includes('Decreto ODC'));
check('Bandeja parroquial usa Decreto de Corrección', parishNotifications.includes('Decreto de Corrección'));
check('Bandeja parroquial usa Decreto de Reposición', parishNotifications.includes('Decreto de Reposición'));
check('Bandeja parroquial muestra sacramento del decreto', parishNotifications.includes('sacramentLabel(notification.sacramentType)'));
check('Detalle parroquial humaniza sacramento', parishDetail.includes('sacramentLabel(sacrament)'));
check('Detalle parroquial humaniza tipo de decreto', parishDetail.includes('decreeTypeLabel(decreeType)'));
check('Detalle parroquial identifica decreto recibido', parishDetail.includes('Decreto recibido por la Parroquia'));

check('V30 habilita RLS en decretos', migration.includes('alter table public.decretos enable row level security'));
check('V30 crea política SELECT por jurisdicción', migration.includes('create policy "decretos_select_scope"') && migration.includes('public.can_access_parish(parish_id)'));
check('V30 no otorga INSERT a Parroquia', !migration.includes('grant insert'));
check('Política de emisión histórica no se modifica en V30', migration.includes('La emisión continúa restringida'));

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`\nSACRAMENTUM V30 · FALLÓ · ${failed.length}/${checks.length} controles.`);
  process.exit(1);
}

console.log(`\nSACRAMENTUM V30 · OK · ${checks.length}/${checks.length} controles.`);
