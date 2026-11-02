// Accesos de presentación. La autorización sigue en ProtectedRoute y en el servidor.
const action = (label, to, icon = 'arrow') => ({ label, to, icon });
const module = (id, label, description, icon, actions) => ({ id, label, description, icon, actions });

export const COMMAND_CENTERS = {
  parish: {
    eyebrow: 'Despacho parroquial',
    description: 'Vida parroquial y sacramentos',
    sectionTitle: 'Sacramentos',
    shortcutTitle: 'Accesos del despacho',
    followUpTitle: 'Para revisar',
    modules: [
      module('baptism', 'Bautismo', 'Registro y archivo bautismal', 'droplets', [
        action('Nuevo bautismo', '/parroquia/bautismo/nuevo', 'plus'),
        action('Digitalizar partida existente', '/parroquia/bautismo/celebrado', 'file'),
        action('Sentar registros', '/parroquia/bautismo/sentar-registros', 'pen'),
        action('Consultar partidas', '/parroquia/bautismo/partidas', 'search'),
      ]),
      module('confirmation', 'Confirmación', 'Celebración y partidas', 'flame', [
        action('Nueva confirmación', '/parroquia/confirmacion/nuevo', 'plus'),
        action('Confirmación celebrada', '/parroquia/confirmacion/celebrado', 'file'),
        action('Sentar registros', '/parroquia/confirmacion/sentar-registros', 'pen'),
        action('Consultar partidas', '/parroquia/confirmacion/partidas', 'search'),
        action('Emitir notificación', '/parroquia/confirmacion/notificacion', 'mail'),
      ]),
      module('marriage', 'Matrimonio', 'Registro y expediente matrimonial', 'heart', [
        action('Nuevo matrimonio', '/parroquia/matrimonio/nuevo', 'plus'),
        action('Matrimonio celebrado', '/parroquia/matrimonio/celebrado', 'file'),
        action('Sentar registros', '/parroquia/matrimonio/sentar-registros', 'pen'),
        action('Consultar partidas', '/parroquia/matrimonio/partidas', 'search'),
        action('Expediente matrimonial', '/parroquia/matrimonio/expedientes', 'folder'),
        action('Emitir notificación', '/parroquia/matrimonio/notificacion', 'mail'),
      ]),
      module('funeral', 'Exequias', 'Registro y partidas de exequias', 'cross', [
        action('Registro de exequias', '/parroquia/exequias', 'pen'),
        action('Consultar partidas', '/parroquia/exequias/partidas', 'search'),
      ]),
    ],
    shortcuts: [
      action('Libros sacramentales', '/parroquia/libros', 'book'),
      action('Centro de decretos', '/parroquia/decretos', 'scroll'),
      action('Datos auxiliares', '/datos-auxiliares', 'database'),
      action('Plantillas documentales', '/documentos/plantillas', 'file'),
      action('Parámetros', '/parroquia/bautismo/parametros', 'sliders'),
      action('Ajustes', '/parroquia/ajustes', 'settings'),
      action('Chat diocesano', '/communications', 'chat'),
      action('Notificaciones de Cancillería', '/parish/notifications', 'bell'),
      action('Notificaciones sacramentales', '/parish/sacramental-notifications', 'mail'),
    ],
    followUp: [
      action('Correcciones recibidas', '/parroquia/decretos/archivo?type=correccion&sacrament=bautismo', 'file'),
      action('Reposiciones recibidas', '/parroquia/decretos/archivo?type=reposicion&sacrament=bautismo', 'scroll'),
      action('Notificaciones de Cancillería', '/parish/notifications', 'bell'),
      action('Notificaciones sacramentales', '/parish/sacramental-notifications', 'mail'),
    ],
  },
  diocese: {
    eyebrow: 'Gobierno pastoral · Jurisdicción eclesiástica',
    description: 'Vida y organización diocesana',
    sectionTitle: 'Gobierno y servicio pastoral',
    shortcutTitle: 'Accesos diocesanos',
    followUpTitle: 'Servicio diocesano',
    modules: [
      module('organization', 'Organización eclesiástica', 'Parroquias, vicarías y decanatos', 'church', [
        action('Abrir organización eclesiástica', '/diocese/ecclesiastical', 'network'),
      ]),
      module('reports', 'Informes sacramentales', 'Consulta y estadística de la jurisdicción', 'chart', [
        action('Consultar informes sacramentales', '/diocese/reports', 'chart'),
      ]),
      module('migration', 'Migración histórica', 'Recepción y revisión del archivo legado', 'archive', [
        action('Abrir Centro de Migración', '/diocese/migration-center', 'archive'),
      ]),
      module('communications', 'Chat diocesano', 'Comunicación institucional', 'chat', [
        action('Abrir chat diocesano', '/communications', 'chat'),
      ]),
    ],
    shortcuts: [],
    followUp: [
      action('Consultar la organización', '/diocese/ecclesiastical', 'network'),
      action('Revisar informes', '/diocese/reports', 'chart'),
      action('Comunicaciones institucionales', '/communications', 'chat'),
    ],
  },
  chancery: {
    eyebrow: 'Curia diocesana · Servicio de Cancillería',
    description: 'Custodia de documentos, decretos y memoria sacramental',
    sectionTitle: 'Gobierno documental',
    shortcutTitle: 'Accesos de Cancillería',
    followUpTitle: 'Para revisar',
    modules: [
      module('decrees', 'Centro de decretos', 'Corrección, reposición y repetición', 'scroll', [
        action('Abrir Centro de Decretos', '/chancery/decretos', 'scroll'),
        action('Archivo de decretos', '/chancery/decretos/archivo', 'archive'),
        action('Conceptos de decreto', '/chancery/decree-annulment', 'file'),
      ]),
      module('pending', 'Expedientes pendientes', 'Revisión de lo reportado por las parroquias', 'folder', [
        action('Revisar sacramentos pendientes', '/chancery/pending', 'clock'),
      ]),
      module('historical', 'Revisión histórica', 'Vínculos y notas por conciliar', 'fileSearch', [
        action('Revisión de Vínculos Históricos', '/chancery/historicos/conciliacion', 'fileSearch'),
        action('Conciliar notas posteriores', '/chancery/decretos/conciliaciones', 'file'),
      ]),
      module('communications', 'Chat diocesano', 'Comunicación con la jurisdicción', 'chat', [
        action('Abrir chat diocesano', '/communications', 'chat'),
      ]),
    ],
    shortcuts: [
      action('Archivo de decretos', '/chancery/decretos/archivo', 'archive'),
      action('Conceptos de decreto', '/chancery/decree-annulment', 'file'),
      { label: 'Configurar membrete', command: 'configureIdentity', icon: 'settings' },
    ],
    followUp: [
      action('Expedientes parroquiales', '/chancery/pending', 'clock'),
      action('Vínculos históricos', '/chancery/historicos/conciliacion', 'fileSearch'),
      action('Chat diocesano', '/communications', 'chat'),
    ],
  },
  admin_general: {
    eyebrow: 'Administración General · Servicio institucional',
    description: 'Jurisdicciones, usuarios y custodia del sistema',
    sectionTitle: 'Administración institucional',
    shortcutTitle: 'Accesos de administración',
    followUpTitle: 'Supervisión institucional',
    modules: [
      module('jurisdictions', 'Diócesis y arquidiócesis', 'Organización y activación de jurisdicciones', 'church', [
        action('Gestionar jurisdicciones', '/admin/dioceses', 'church'),
      ]),
      module('users', 'Usuarios institucionales', 'Cuentas y acceso institucional', 'users', [
        action('Gestionar usuarios', '/admin/users', 'users'),
      ]),
      module('migration', 'Migración histórica', 'Supervisión del archivo legado', 'archive', [
        action('Abrir Centro de Migración', '/admin/migration-center', 'archive'),
      ]),
      module('security', 'Seguridad y respaldos', 'Configuración y custodia del sistema', 'shield', [
        action('Abrir ajustes del sistema', '/admin/settings', 'settings'),
      ]),
    ],
    shortcuts: [],
    followUp: [
      action('Jurisdicciones y activación', '/admin/dioceses', 'church'),
      action('Usuarios institucionales', '/admin/users', 'users'),
      action('Seguridad y respaldos', '/admin/settings', 'shield'),
    ],
  },
};

export function getCommandCenter(role) {
  return Object.hasOwn(COMMAND_CENTERS, role) ? COMMAND_CENTERS[role] : null;
}
