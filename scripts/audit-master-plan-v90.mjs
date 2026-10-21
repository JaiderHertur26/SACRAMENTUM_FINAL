import fs from 'node:fs';
const source = [
['01','Inventario de código y procesos','P0','Rutas React y roles;Pantallas activas y huérfanas;Servicios con operaciones CRUD;Tablas/vistas y claves;Funciones RPC;Triggers y políticas SQL;Mapa desde botón hasta tabla;Dependencias entre módulos'],
['02','Derecho canónico y alcance documental','P0','Modelo de cada sacramento;Corrección y reposición;Nulidad matrimonial de tribunal;Autoridad de Cancillería;Documentación antigua vs emisión actual;Libro físico y folio legítimos;Original y supletoria;Firma sello y validez'],
['03','Autenticación y sesión','P0','Inicio correcto de sesión;Contraseña incorrecta;Caducidad de JWT;Cierre de sesión;Usuario bloqueado;Reactivación de usuario;Sesiones simultáneas;Restauración tras refresh;Recuperación de contraseña;No claves privilegiadas en frontend'],
['04','Roles y creación de usuarios','P0','Administrador General crea diócesis;Diócesis crea parroquia;Diócesis crea Canciller;Canciller único activo;Parroquia no crea superiores;Rol inválido denegado;Traslado administrativo;Usuarios entre dos diócesis;Ruta protegida por servidor;Baja conserva auditoría'],
['05','Jerarquía territorial','P1','Diócesis y Arquidiócesis;Vicarías;Decanatos;Parroquias;Parroquias antiguas no operativas;No traslado sin autorización;Referencias y códigos únicos;Catálogos eclesiales'],
['06','RLS y privilegios del backend','P0','RLS de tablas públicas;RLS SELECT por actor;RLS INSERT por actor;RLS UPDATE y WITH CHECK;RLS DELETE por actor;129 RPC privilegiadas autorizadas;129 RPC privilegiadas denegadas a terceros;Search path de funciones;Filtración por GraphQL;No privilegios anónimos;Identidad JWT validada en servidor;No metadatos de usuario editables para autorizar'],
['07','Integridad y concurrencia','P0','Unicidad Libro Folio Número;Colisión de número de decreto;Concurrencia de dos usuarios en una partida;Consecutivos de boletas;Reintento idempotente;Transacción atomicidad;Llaves foráneas sin huérfanos;Bloqueos y deadlocks;Restauración tras timeout'],
['08','Bautismo','P0','Nueva boleta;Celebración;Asiento en libro;Libro Folio Número;Impresión;Importación de partida;Digitalización sin consumir consecutivo;Corrección por decreto;Reposición por decreto;Reversión y trazas;Notas múltiples'],
['09','Confirmación','P0','Nueva boleta;Fecha y hora;Celebración;Asiento en libro;Impresión;Referencia a Bautismo;Importación reportada;Importación no reportada;Corrección y reposición;Reversión;Notas múltiples'],
['10','Matrimonio','P0','Datos de ambos contrayentes;Expediente matrimonial;Notificaciones;Celebración;Asiento y libro;Impresión;Importación MATRIMON;Notas NTMAT;Corrección por decreto;Reposición;Nulidad como tribunal'],
['11','Exequias','P0','Inscripción;Nacimiento antes de defunción;Exequias después de defunción;Libro ordinario;Libro supletorio;Busca Bautismo;Marca fallecido;Decretos;Notas;Impresión'],
['12','Decretos nuevos en Cancillería','P0','Competencia exclusiva de Cancillería;Número y fecha únicos;Concepto jurídico compatible;Corrección afecta original;Reposición crea supletoria;Documental no afecta partida;Aviso a parroquia;Archivo único en dos roles;Firma e impresión;Reversión autorizada;Doble emisión impedida'],
['13','Decretos antiguos importados','P0','Origen histórico verificable;No simular nueva emisión;Parroquia y diócesis exactas;Colisiones entre lotes;Par original/supletoria;No aplicar efectos dos veces;Decreto ANULACION conciliado;Cinco ANULACION pendientes;Revisión de caso ambiguo;Archivo en Cancillería y parroquia;Fuente original preservada'],
['14','Notas marginales','P0','Varias notas por partida;Fechas originales;Tipo jurídico correcto;Vínculo a decreto;Vínculo a original/supletoria;Notas importadas sin fecha inventada;Pendientes sin partida;Histórico impreso;Auditoría de anotación'],
['15','Boletas y pendientes','P0','Alta manual y número;reported verdadero;reported falso;Numeración única;Sin fechas inventadas;Edición autorizada;Cancelación controlada;Doble clic sin duplicado;Cierre en partida;Cruce histórico'],
['16','Centro de Migración','P0','DBF a CSV a JSON;Codificaciones extrañas;Parroquia obligatoria;Hash e idempotencia;Staging y revisión;Errores parciales;16 mil filas con paginación;Catálogos auxiliares;ANULACION y conceptos;NTMAT;Archivos corruptos;Rollback sin contaminación'],
['17','Datos auxiliares','P1','Ciudades y países;Iglesias;Parroquias externas;Párrocos activos;Fechas de vigencia;Obispos;Autocompletado;Da Fe histórico sin suposición;Duplicados y restricciones'],
['18','Notificaciones institucionales','P1','Cancillería emite aviso;Parroquia recibe aviso;Marcar recibido;Lectura sólo destinatario;Estado de trámite;Notificación matrimonial;Errores de entrega;Sin duplicación por reintento;Historial de avisos'],
['19','Chat y comunicaciones','P1','Miembros de sala;Prohibir sala ajena;Enviar mensaje;Responder;Marcar leído;Retirar mensaje;Limitar tamaño;Contenido malicioso;Paginación de sala;Sesión expirada'],
['20','Búsqueda y consulta','P0','Búsqueda pública mínima;Búsqueda parroquial propia;Búsqueda diocesana;Apellido y nombre;Libro Folio Número;Anulada y supletoria;Datos importados;Caracteres adversariales;Paginación sin omisión;Privacidad de resultados'],
['21','Libros e índices','P0','Cuatro sacramentos;Folios físicos;Libro ordinario;Supletorio;Anulado/revertido;Índice PDF;Ordenamiento;Paginación;Archivo histórico y corriente;Consistencia con reportes'],
['22','Impresiones y plantillas','P0','Partidas completas;Decretos oficiales;Documento histórico marcado;No inventar firma;Títulos y tipografías;Formato carta y A4;Nombres largos;Saltos de página;Escapar HTML;Registro de impresión;Concordancia jurídica'],
['23','Reportes estadísticos','P1','Parroquia;Decanato;Vicaría;Diócesis;Administrador General;Rango de años;Bandas etarias;No doble conteo por corrección;Descarga;Concordancia con SQL;Rendimiento'],
['24','Diseño y accesibilidad','P1','Entrar a todas las pantallas;Móvil;Tableta;Escritorio;Zoom 200%;Contraste;Navegación por teclado;Foco;Etiquetas accesibles;Botones activos;Mensajes de error;Capturas de evidencia'],
['25','Resiliencia','P0','Sin conexión antes de guardar;Sin conexión durante RPC;Sin conexión después de respuesta;HTTP 401/403;HTTP 409;HTTP 500;Timeout;Retry seguro;Refresh en formulario;Interrupción de impresión;Error de lectura sin pérdida'],
['26','Rendimiento','P1','5 mil bautismos;2 mil confirmaciones;16 mil filas históricas;Archivo de más mil decretos;Consultas por índices;Memoria de PDF;Usuarios concurrentes;Tiempo de carga;Rate limiting;Errores bajo carga'],
['27','Ciberseguridad adversarial','P0','Escalamiento vertical;Escalamiento horizontal;IDOR de parroquia;RPC directa prohibida;SQL injection;XSS;Fuga JWT;Secretos en build;CORS;CSRF;Privilegios de storage;Funciones SECURITY DEFINER'],
['28','Privacidad y tratamiento de datos','P0','Datos mínimos por rol;Auditoría de lectura;Logs sin secretos;Exportación autorizada;Retención jurídica;Usuarios fallecidos y correcciones;Respaldo cifrado;Acceso a copias;Procedimiento de incidente'],
['29','Backup restauración y desastre','P0','Política de respaldos;Exportación completa;Restauración en proyecto desechable;Integridad por conteos;Integridad por hashes;RPO/RTO medidos;Restaurar decretos y notas;Rollback de frontend;Rollback de esquema;Aislamiento entre parroquias'],
['30','Despliegue y dependencias','P1','Node y lockfile;npm audit;CI automática;Migraciones reproducibles;Preview de Vercel;Variables secretas;Construcción de producción;Smoke posdespliegue;Git versionado;Plan rollback'],
['31','E2E de personajes ficticios','P0','Diócesis de ensayo aislada;Parroquias ficticias A y B;Cuatro roles ficticios;Bautismo a Confirmación;Matrimonio y notificaciones;Exequias y fallecido;Decretos nuevos e históricos;Doble click y red caída;Impresión/estadística final;Destruir sandbox y demostrar cero residuos'],
['32','Auditoría forense de cierre','P0','Versionar toda prueba;Guardar entrada y expectativa;Guardar resultado exacto;Guardar capturas;Rastrear hallazgos P0/P1/P2;Corregir y repetir;Regresión completa;Conteos antes/después;Confirmar producción Ready;Dictamen con limitaciones verificadas']
];
const jsonPath='AUDITORIA_MAESTRA_CONTROLES_V90.json';
if(!fs.existsSync(jsonPath)) {
 const controls=source.flatMap(([phase,area,priority,raw])=>raw.split(';').map((criterion,i)=>({
   id:phase+'.'+String(i+1).padStart(2,'0'), phase:Number(phase), area, priority,
   criterion, status:'PENDIENTE', evidence:[], updated_at:null
 })));
 fs.writeFileSync(jsonPath,JSON.stringify({
   protocol:'V90',date:'2026-10-21',statuses:['PENDIENTE','EN_PROGRESO','APROBADO','FALLIDO','BLOQUEADO'],
   approval_rule:'Un control se aprueba sólo con evidencia reproducible de su resultado y alcance.',
   controls
 },null,2)+'\n');
}
const data=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
const counts={};for(const c of data.controls)counts[c.status]=(counts[c.status]||0)+1;
const out=[
'# SACRAMENTUM · PLAN MAESTRO DE AUDITORÍA EXTRAORDINARIA V90','',
'Fecha inicial: 21 de octubre de 2026. Proyecto canónico: C:\\SACRAMENTUM\\SACRAMENTUM_FINAL','',
'Objetivo: la cobertura técnica más rigurosa posible, con pruebas reproducibles y adversariales. No existe una métrica verificable de mejor auditoría de la historia ni perfección absoluta.','',
'Regla: ningún caso se marca aprobado por compilación o existencia de rutas si exige interacción real o efecto del servidor.','',
'Regla: no introducir datos falsos permanentes; usar memoria, transacciones ROLLBACK o sandbox separado. Nunca ejecutar expedientes jurídicos reales como prueba.','',
'Prioridad P0 bloquea la certificación. P1 debe constar resuelta o aceptada con evidencia y responsable.','',
'Avance: '+data.controls.length+' controles totales; '+(counts.APROBADO||0)+' aprobados; '+(counts.EN_PROGRESO||0)+' en progreso; '+(counts.PENDIENTE||0)+' pendientes; '+(counts.FALLIDO||0)+' fallidos; '+(counts.BLOQUEADO||0)+' bloqueados.','',
'## Fases y controles numerados',''
];
for(const [phase,name,priority] of source){
 const set=data.controls.filter(c=>String(c.phase).padStart(2,'0')===phase);
 out.push('### '+phase+'. '+name+' ('+priority+') — '+set.filter(x=>x.status==='APROBADO').length+'/'+set.length,'');
 for(const c of set){
   out.push('- ['+(c.status==='APROBADO'?'x':' ')+'] '+c.id+' · '+c.criterion+' — '+c.status);
   for(const ev of c.evidence||[])out.push('  - Evidencia: '+ev);
 }
 out.push('');
}
out.push('## Hechos verificados previos al nuevo protocolo','',
'- V89: 206/206 pruebas sintéticas, 23/23 verificadores anteriores y compilación OK; estos números no aprueban automáticamente el nuevo plan.',
'- Inventario SQL: 73/73 tablas públicas con RLS; 129 funciones SECURITY DEFINER ejecutables por authenticated y ninguna por anon.',
'- Seguridad V89: bloqueados INSERT, UPDATE y DELETE directos en decretos; concepto reservado a Cancillería; trazas restringidas.',
'- Pendientes: cinco ANULACION históricos, posible consecutivo supletorio de Bautismo ocupado, recorrido visual autenticado, restauración del respaldo.',
'- Supabase Advisors: revisión pendiente de advertencias GraphQL y RPC privilegiadas.',
'','## Gestión del progreso','',
'El JSON conserva un estado y evidencia por control. Este generador no sobrescribe el JSON cuando ya existe. Sólo marcar APROBADO después de una prueba verificable.','',
'Comandos:','',
'    cd C:\\SACRAMENTUM\\SACRAMENTUM_FINAL',
'    node scripts/audit-master-plan-v90.mjs',
'    node --test scripts/test-sistema-integral-v89.mjs scripts/test-chancery-decrees-v88.mjs scripts/test-supplementary-preflight-v89.mjs',
'    npm run build','');
fs.writeFileSync('AUDITORIA_MAESTRA_SACRAMENTUM_V90.md',out.join('\n'),'utf8');
console.log('Plan maestro: '+source.length+' fases, '+data.controls.length+' controles, '+(counts.APROBADO||0)+' aprobados.');
