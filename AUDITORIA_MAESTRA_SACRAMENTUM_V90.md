# SACRAMENTUM · PLAN MAESTRO DE AUDITORÍA EXTRAORDINARIA V90

Fecha inicial: 21 de octubre de 2026. Proyecto canónico: C:\SACRAMENTUM\SACRAMENTUM_FINAL

Objetivo: la cobertura técnica más rigurosa posible, con pruebas reproducibles y adversariales. No existe una métrica verificable de mejor auditoría de la historia ni perfección absoluta.

Regla: ningún caso se marca aprobado por compilación o existencia de rutas si exige interacción real o efecto del servidor.

Regla: no introducir datos falsos permanentes; usar memoria, transacciones ROLLBACK o sandbox separado. Nunca ejecutar expedientes jurídicos reales como prueba.

Prioridad P0 bloquea la certificación. P1 debe constar resuelta o aceptada con evidencia y responsable.

Avance: 325 controles totales; 4 aprobados; 11 en progreso; 309 pendientes; 1 fallidos; 0 bloqueados.

## Fases y controles numerados

### 01. Inventario de código y procesos (P0) — 1/8

- [x] 01.01 · Rutas React y roles — APROBADO
  - Evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json: Rutas App.jsx inventariadas: 109; sin fallos de parseo ni importaciones locales rotas
- [ ] 01.02 · Pantallas activas y huérfanas — EN_PROGRESO
  - Evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json: 73 páginas JSX reconocidas; falta análisis de módulos inactivos y cobertura dinámica
- [ ] 01.03 · Servicios con operaciones CRUD — EN_PROGRESO
  - Evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json: Scanner identifica 79 referencias RPC y 43 operaciones directas; falta probar todas
- [ ] 01.04 · Tablas/vistas y claves — EN_PROGRESO
  - Evidencia: AUDITORIA_BASE_SQL_V90.md: 73 tablas, 138 FK y 95 restricciones claves inventariadas por conteo; falta detalle completo
- [ ] 01.05 · Funciones RPC — EN_PROGRESO
  - Evidencia: AUDITORIA_BASE_SQL_V90.md: 211 funciones públicas y 129 privilegiadas accesibles a authenticated; falta mapa y pruebas individuales
- [ ] 01.06 · Triggers y políticas SQL — EN_PROGRESO
  - Evidencia: AUDITORIA_BASE_SQL_V90.md: 49 triggers y 124 políticas RLS inventariados por conteo; falta análisis funcional
- [ ] 01.07 · Mapa desde botón hasta tabla — EN_PROGRESO
  - Evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json: 79 usos RPC, 43 escrituras directas inventariados; falta mapear cada botón al efecto jurídico y SQL
- [ ] 01.08 · Dependencias entre módulos — EN_PROGRESO
  - Evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json: Se analizaron 1550 referencias de imports, cero faltantes; falta grafo completo y operaciones dinámicas

### 02. Derecho canónico y alcance documental (P0) — 0/8

- [ ] 02.01 · Modelo de cada sacramento — PENDIENTE
- [ ] 02.02 · Corrección y reposición — PENDIENTE
- [ ] 02.03 · Nulidad matrimonial de tribunal — PENDIENTE
- [ ] 02.04 · Autoridad de Cancillería — PENDIENTE
- [ ] 02.05 · Documentación antigua vs emisión actual — PENDIENTE
- [ ] 02.06 · Libro físico y folio legítimos — PENDIENTE
- [ ] 02.07 · Original y supletoria — PENDIENTE
- [ ] 02.08 · Firma sello y validez — PENDIENTE

### 03. Autenticación y sesión (P0) — 0/10

- [ ] 03.01 · Inicio correcto de sesión — PENDIENTE
- [ ] 03.02 · Contraseña incorrecta — PENDIENTE
- [ ] 03.03 · Caducidad de JWT — PENDIENTE
- [ ] 03.04 · Cierre de sesión — PENDIENTE
- [ ] 03.05 · Usuario bloqueado — PENDIENTE
- [ ] 03.06 · Reactivación de usuario — PENDIENTE
- [ ] 03.07 · Sesiones simultáneas — PENDIENTE
- [ ] 03.08 · Restauración tras refresh — PENDIENTE
- [ ] 03.09 · Recuperación de contraseña — PENDIENTE
- [ ] 03.10 · No claves privilegiadas en frontend — PENDIENTE

### 04. Roles y creación de usuarios (P0) — 0/10

- [ ] 04.01 · Administrador General crea diócesis — PENDIENTE
- [ ] 04.02 · Diócesis crea parroquia — PENDIENTE
- [ ] 04.03 · Diócesis crea Canciller — PENDIENTE
- [ ] 04.04 · Canciller único activo — PENDIENTE
- [ ] 04.05 · Parroquia no crea superiores — PENDIENTE
- [ ] 04.06 · Rol inválido denegado — PENDIENTE
- [ ] 04.07 · Traslado administrativo — PENDIENTE
- [ ] 04.08 · Usuarios entre dos diócesis — PENDIENTE
- [ ] 04.09 · Ruta protegida por servidor — PENDIENTE
- [ ] 04.10 · Baja conserva auditoría — PENDIENTE

### 05. Jerarquía territorial (P1) — 0/8

- [ ] 05.01 · Diócesis y Arquidiócesis — PENDIENTE
- [ ] 05.02 · Vicarías — PENDIENTE
- [ ] 05.03 · Decanatos — PENDIENTE
- [ ] 05.04 · Parroquias — PENDIENTE
- [ ] 05.05 · Parroquias antiguas no operativas — PENDIENTE
- [ ] 05.06 · No traslado sin autorización — PENDIENTE
- [ ] 05.07 · Referencias y códigos únicos — PENDIENTE
- [ ] 05.08 · Catálogos eclesiales — PENDIENTE

### 06. RLS y privilegios del backend (P0) — 2/12

- [x] 06.01 · RLS de tablas públicas — APROBADO
  - Evidencia: AUDITORIA_BASE_SQL_V90.md: Consulta SQL al catálogo: las 73 tablas públicas tienen RLS y cero carecen de RLS
- [ ] 06.02 · RLS SELECT por actor — EN_PROGRESO
  - Evidencia: AUDITORIA_RLS_PARROQUIAL_V90.md: Ensayo con rol Parroquia autenticado: cero filas de otras parroquias en 10 entidades; falta matriz completa y operaciones de escritura
- [ ] 06.03 · RLS INSERT por actor — PENDIENTE
- [ ] 06.04 · RLS UPDATE y WITH CHECK — PENDIENTE
- [ ] 06.05 · RLS DELETE por actor — PENDIENTE
- [ ] 06.06 · 129 RPC privilegiadas autorizadas — PENDIENTE
- [ ] 06.07 · 129 RPC privilegiadas denegadas a terceros — EN_PROGRESO
  - Evidencia: AUDITORIA_BASE_SQL_V90.md: Cero vistas públicas; 129 RPC privilegiadas requieren pruebas de permisos y búsqueda de bypass
- [ ] 06.08 · Search path de funciones — PENDIENTE
- [ ] 06.09 · Filtración por GraphQL — PENDIENTE
- [x] 06.10 · No privilegios anónimos — APROBADO
  - Evidencia: AUDITORIA_BASE_SQL_V90.md: Catálogo de grants: cero RPC SECURITY DEFINER ejecutables por rol anon
- [ ] 06.11 · Identidad JWT validada en servidor — PENDIENTE
- [ ] 06.12 · No metadatos de usuario editables para autorizar — PENDIENTE

### 07. Integridad y concurrencia (P0) — 0/9

- [ ] 07.01 · Unicidad Libro Folio Número — PENDIENTE
- [ ] 07.02 · Colisión de número de decreto — PENDIENTE
- [ ] 07.03 · Concurrencia de dos usuarios en una partida — PENDIENTE
- [ ] 07.04 · Consecutivos de boletas — PENDIENTE
- [ ] 07.05 · Reintento idempotente — PENDIENTE
- [ ] 07.06 · Transacción atomicidad — PENDIENTE
- [ ] 07.07 · Llaves foráneas sin huérfanos — PENDIENTE
- [ ] 07.08 · Bloqueos y deadlocks — PENDIENTE
- [ ] 07.09 · Restauración tras timeout — PENDIENTE

### 08. Bautismo (P0) — 0/11

- [ ] 08.01 · Nueva boleta — PENDIENTE
- [ ] 08.02 · Celebración — PENDIENTE
- [ ] 08.03 · Asiento en libro — PENDIENTE
- [ ] 08.04 · Libro Folio Número — PENDIENTE
- [ ] 08.05 · Impresión — PENDIENTE
- [ ] 08.06 · Importación de partida — PENDIENTE
- [ ] 08.07 · Digitalización sin consumir consecutivo — PENDIENTE
- [ ] 08.08 · Corrección por decreto — PENDIENTE
- [ ] 08.09 · Reposición por decreto — PENDIENTE
- [ ] 08.10 · Reversión y trazas — PENDIENTE
- [ ] 08.11 · Notas múltiples — PENDIENTE

### 09. Confirmación (P0) — 0/11

- [ ] 09.01 · Nueva boleta — PENDIENTE
- [ ] 09.02 · Fecha y hora — PENDIENTE
- [ ] 09.03 · Celebración — PENDIENTE
- [ ] 09.04 · Asiento en libro — PENDIENTE
- [ ] 09.05 · Impresión — PENDIENTE
- [ ] 09.06 · Referencia a Bautismo — PENDIENTE
- [ ] 09.07 · Importación reportada — PENDIENTE
- [ ] 09.08 · Importación no reportada — PENDIENTE
- [ ] 09.09 · Corrección y reposición — PENDIENTE
- [ ] 09.10 · Reversión — PENDIENTE
- [ ] 09.11 · Notas múltiples — PENDIENTE

### 10. Matrimonio (P0) — 0/11

- [ ] 10.01 · Datos de ambos contrayentes — PENDIENTE
- [ ] 10.02 · Expediente matrimonial — PENDIENTE
- [ ] 10.03 · Notificaciones — PENDIENTE
- [ ] 10.04 · Celebración — PENDIENTE
- [ ] 10.05 · Asiento y libro — PENDIENTE
- [ ] 10.06 · Impresión — PENDIENTE
- [ ] 10.07 · Importación MATRIMON — PENDIENTE
- [ ] 10.08 · Notas NTMAT — PENDIENTE
- [ ] 10.09 · Corrección por decreto — PENDIENTE
- [ ] 10.10 · Reposición — PENDIENTE
- [ ] 10.11 · Nulidad como tribunal — PENDIENTE

### 11. Exequias (P0) — 0/10

- [ ] 11.01 · Inscripción — PENDIENTE
- [ ] 11.02 · Nacimiento antes de defunción — PENDIENTE
- [ ] 11.03 · Exequias después de defunción — PENDIENTE
- [ ] 11.04 · Libro ordinario — PENDIENTE
- [ ] 11.05 · Libro supletorio — PENDIENTE
- [ ] 11.06 · Busca Bautismo — PENDIENTE
- [ ] 11.07 · Marca fallecido — PENDIENTE
- [ ] 11.08 · Decretos — PENDIENTE
- [ ] 11.09 · Notas — PENDIENTE
- [ ] 11.10 · Impresión — PENDIENTE

### 12. Decretos nuevos en Cancillería (P0) — 0/11

- [ ] 12.01 · Competencia exclusiva de Cancillería — PENDIENTE
- [ ] 12.02 · Número y fecha únicos — PENDIENTE
- [ ] 12.03 · Concepto jurídico compatible — PENDIENTE
- [ ] 12.04 · Corrección afecta original — PENDIENTE
- [ ] 12.05 · Reposición crea supletoria — PENDIENTE
- [ ] 12.06 · Documental no afecta partida — PENDIENTE
- [ ] 12.07 · Aviso a parroquia — PENDIENTE
- [ ] 12.08 · Archivo único en dos roles — PENDIENTE
- [ ] 12.09 · Firma e impresión — PENDIENTE
- [ ] 12.10 · Reversión autorizada — PENDIENTE
- [ ] 12.11 · Doble emisión impedida — PENDIENTE

### 13. Decretos antiguos importados (P0) — 0/11

- [ ] 13.01 · Origen histórico verificable — PENDIENTE
- [ ] 13.02 · No simular nueva emisión — PENDIENTE
- [ ] 13.03 · Parroquia y diócesis exactas — PENDIENTE
- [ ] 13.04 · Colisiones entre lotes — PENDIENTE
- [ ] 13.05 · Par original/supletoria — PENDIENTE
- [ ] 13.06 · No aplicar efectos dos veces — PENDIENTE
- [ ] 13.07 · Decreto ANULACION conciliado — PENDIENTE
- [ ] 13.08 · Cinco ANULACION pendientes — PENDIENTE
- [ ] 13.09 · Revisión de caso ambiguo — PENDIENTE
- [ ] 13.10 · Archivo en Cancillería y parroquia — PENDIENTE
- [ ] 13.11 · Fuente original preservada — PENDIENTE

### 14. Notas marginales (P0) — 0/9

- [ ] 14.01 · Varias notas por partida — PENDIENTE
- [ ] 14.02 · Fechas originales — PENDIENTE
- [ ] 14.03 · Tipo jurídico correcto — PENDIENTE
- [ ] 14.04 · Vínculo a decreto — PENDIENTE
- [ ] 14.05 · Vínculo a original/supletoria — PENDIENTE
- [ ] 14.06 · Notas importadas sin fecha inventada — PENDIENTE
- [ ] 14.07 · Pendientes sin partida — PENDIENTE
- [ ] 14.08 · Histórico impreso — PENDIENTE
- [ ] 14.09 · Auditoría de anotación — PENDIENTE

### 15. Boletas y pendientes (P0) — 0/10

- [ ] 15.01 · Alta manual y número — PENDIENTE
- [ ] 15.02 · reported verdadero — PENDIENTE
- [ ] 15.03 · reported falso — PENDIENTE
- [ ] 15.04 · Numeración única — PENDIENTE
- [ ] 15.05 · Sin fechas inventadas — PENDIENTE
- [ ] 15.06 · Edición autorizada — PENDIENTE
- [ ] 15.07 · Cancelación controlada — PENDIENTE
- [ ] 15.08 · Doble clic sin duplicado — PENDIENTE
- [ ] 15.09 · Cierre en partida — PENDIENTE
- [ ] 15.10 · Cruce histórico — PENDIENTE

### 16. Centro de Migración (P0) — 0/12

- [ ] 16.01 · DBF a CSV a JSON — PENDIENTE
- [ ] 16.02 · Codificaciones extrañas — PENDIENTE
- [ ] 16.03 · Parroquia obligatoria — PENDIENTE
- [ ] 16.04 · Hash e idempotencia — PENDIENTE
- [ ] 16.05 · Staging y revisión — PENDIENTE
- [ ] 16.06 · Errores parciales — PENDIENTE
- [ ] 16.07 · 16 mil filas con paginación — PENDIENTE
- [ ] 16.08 · Catálogos auxiliares — PENDIENTE
- [ ] 16.09 · ANULACION y conceptos — PENDIENTE
- [ ] 16.10 · NTMAT — PENDIENTE
- [ ] 16.11 · Archivos corruptos — PENDIENTE
- [ ] 16.12 · Rollback sin contaminación — PENDIENTE

### 17. Datos auxiliares (P1) — 0/9

- [ ] 17.01 · Ciudades y países — PENDIENTE
- [ ] 17.02 · Iglesias — PENDIENTE
- [ ] 17.03 · Parroquias externas — PENDIENTE
- [ ] 17.04 · Párrocos activos — PENDIENTE
- [ ] 17.05 · Fechas de vigencia — PENDIENTE
- [ ] 17.06 · Obispos — PENDIENTE
- [ ] 17.07 · Autocompletado — PENDIENTE
- [ ] 17.08 · Da Fe histórico sin suposición — PENDIENTE
- [ ] 17.09 · Duplicados y restricciones — PENDIENTE

### 18. Notificaciones institucionales (P1) — 0/9

- [ ] 18.01 · Cancillería emite aviso — PENDIENTE
- [ ] 18.02 · Parroquia recibe aviso — PENDIENTE
- [ ] 18.03 · Marcar recibido — PENDIENTE
- [ ] 18.04 · Lectura sólo destinatario — PENDIENTE
- [ ] 18.05 · Estado de trámite — PENDIENTE
- [ ] 18.06 · Notificación matrimonial — PENDIENTE
- [ ] 18.07 · Errores de entrega — PENDIENTE
- [ ] 18.08 · Sin duplicación por reintento — PENDIENTE
- [ ] 18.09 · Historial de avisos — PENDIENTE

### 19. Chat y comunicaciones (P1) — 0/10

- [ ] 19.01 · Miembros de sala — PENDIENTE
- [ ] 19.02 · Prohibir sala ajena — PENDIENTE
- [ ] 19.03 · Enviar mensaje — PENDIENTE
- [ ] 19.04 · Responder — PENDIENTE
- [ ] 19.05 · Marcar leído — PENDIENTE
- [ ] 19.06 · Retirar mensaje — PENDIENTE
- [ ] 19.07 · Limitar tamaño — PENDIENTE
- [ ] 19.08 · Contenido malicioso — PENDIENTE
- [ ] 19.09 · Paginación de sala — PENDIENTE
- [ ] 19.10 · Sesión expirada — PENDIENTE

### 20. Búsqueda y consulta (P0) — 0/10

- [ ] 20.01 · Búsqueda pública mínima — PENDIENTE
- [ ] 20.02 · Búsqueda parroquial propia — PENDIENTE
- [ ] 20.03 · Búsqueda diocesana — PENDIENTE
- [ ] 20.04 · Apellido y nombre — PENDIENTE
- [ ] 20.05 · Libro Folio Número — PENDIENTE
- [ ] 20.06 · Anulada y supletoria — PENDIENTE
- [ ] 20.07 · Datos importados — PENDIENTE
- [ ] 20.08 · Caracteres adversariales — PENDIENTE
- [ ] 20.09 · Paginación sin omisión — PENDIENTE
- [ ] 20.10 · Privacidad de resultados — PENDIENTE

### 21. Libros e índices (P0) — 0/10

- [ ] 21.01 · Cuatro sacramentos — PENDIENTE
- [ ] 21.02 · Folios físicos — PENDIENTE
- [ ] 21.03 · Libro ordinario — PENDIENTE
- [ ] 21.04 · Supletorio — PENDIENTE
- [ ] 21.05 · Anulado/revertido — PENDIENTE
- [ ] 21.06 · Índice PDF — PENDIENTE
- [ ] 21.07 · Ordenamiento — PENDIENTE
- [ ] 21.08 · Paginación — PENDIENTE
- [ ] 21.09 · Archivo histórico y corriente — PENDIENTE
- [ ] 21.10 · Consistencia con reportes — PENDIENTE

### 22. Impresiones y plantillas (P0) — 0/11

- [ ] 22.01 · Partidas completas — PENDIENTE
- [ ] 22.02 · Decretos oficiales — PENDIENTE
- [ ] 22.03 · Documento histórico marcado — PENDIENTE
- [ ] 22.04 · No inventar firma — PENDIENTE
- [ ] 22.05 · Títulos y tipografías — PENDIENTE
- [ ] 22.06 · Formato carta y A4 — PENDIENTE
- [ ] 22.07 · Nombres largos — PENDIENTE
- [ ] 22.08 · Saltos de página — PENDIENTE
- [ ] 22.09 · Escapar HTML — PENDIENTE
- [ ] 22.10 · Registro de impresión — PENDIENTE
- [ ] 22.11 · Concordancia jurídica — PENDIENTE

### 23. Reportes estadísticos (P1) — 0/11

- [ ] 23.01 · Parroquia — PENDIENTE
- [ ] 23.02 · Decanato — PENDIENTE
- [ ] 23.03 · Vicaría — PENDIENTE
- [ ] 23.04 · Diócesis — PENDIENTE
- [ ] 23.05 · Administrador General — PENDIENTE
- [ ] 23.06 · Rango de años — PENDIENTE
- [ ] 23.07 · Bandas etarias — PENDIENTE
- [ ] 23.08 · No doble conteo por corrección — PENDIENTE
- [ ] 23.09 · Descarga — PENDIENTE
- [ ] 23.10 · Concordancia con SQL — PENDIENTE
- [ ] 23.11 · Rendimiento — PENDIENTE

### 24. Diseño y accesibilidad (P1) — 0/12

- [ ] 24.01 · Entrar a todas las pantallas — PENDIENTE
- [ ] 24.02 · Móvil — PENDIENTE
- [ ] 24.03 · Tableta — PENDIENTE
- [ ] 24.04 · Escritorio — PENDIENTE
- [ ] 24.05 · Zoom 200% — PENDIENTE
- [ ] 24.06 · Contraste — PENDIENTE
- [ ] 24.07 · Navegación por teclado — PENDIENTE
- [ ] 24.08 · Foco — PENDIENTE
- [ ] 24.09 · Etiquetas accesibles — PENDIENTE
- [ ] 24.10 · Botones activos — PENDIENTE
- [ ] 24.11 · Mensajes de error — PENDIENTE
- [ ] 24.12 · Capturas de evidencia — PENDIENTE

### 25. Resiliencia (P0) — 0/11

- [ ] 25.01 · Sin conexión antes de guardar — PENDIENTE
- [ ] 25.02 · Sin conexión durante RPC — PENDIENTE
- [ ] 25.03 · Sin conexión después de respuesta — PENDIENTE
- [ ] 25.04 · HTTP 401/403 — PENDIENTE
- [ ] 25.05 · HTTP 409 — PENDIENTE
- [ ] 25.06 · HTTP 500 — PENDIENTE
- [ ] 25.07 · Timeout — PENDIENTE
- [ ] 25.08 · Retry seguro — PENDIENTE
- [ ] 25.09 · Refresh en formulario — PENDIENTE
- [ ] 25.10 · Interrupción de impresión — PENDIENTE
- [ ] 25.11 · Error de lectura sin pérdida — PENDIENTE

### 26. Rendimiento (P1) — 0/10

- [ ] 26.01 · 5 mil bautismos — PENDIENTE
- [ ] 26.02 · 2 mil confirmaciones — PENDIENTE
- [ ] 26.03 · 16 mil filas históricas — PENDIENTE
- [ ] 26.04 · Archivo de más mil decretos — PENDIENTE
- [ ] 26.05 · Consultas por índices — PENDIENTE
- [ ] 26.06 · Memoria de PDF — PENDIENTE
- [ ] 26.07 · Usuarios concurrentes — PENDIENTE
- [ ] 26.08 · Tiempo de carga — PENDIENTE
- [ ] 26.09 · Rate limiting — PENDIENTE
- [ ] 26.10 · Errores bajo carga — PENDIENTE

### 27. Ciberseguridad adversarial (P0) — 0/12

- [ ] 27.01 · Escalamiento vertical — PENDIENTE
- [ ] 27.02 · Escalamiento horizontal — PENDIENTE
- [ ] 27.03 · IDOR de parroquia — PENDIENTE
- [ ] 27.04 · RPC directa prohibida — PENDIENTE
- [ ] 27.05 · SQL injection — PENDIENTE
- [ ] 27.06 · XSS — PENDIENTE
- [ ] 27.07 · Fuga JWT — PENDIENTE
- [ ] 27.08 · Secretos en build — PENDIENTE
- [ ] 27.09 · CORS — PENDIENTE
- [ ] 27.10 · CSRF — PENDIENTE
- [ ] 27.11 · Privilegios de storage — PENDIENTE
- [ ] 27.12 · Funciones SECURITY DEFINER — PENDIENTE

### 28. Privacidad y tratamiento de datos (P0) — 0/9

- [ ] 28.01 · Datos mínimos por rol — PENDIENTE
- [ ] 28.02 · Auditoría de lectura — PENDIENTE
- [ ] 28.03 · Logs sin secretos — PENDIENTE
- [ ] 28.04 · Exportación autorizada — PENDIENTE
- [ ] 28.05 · Retención jurídica — PENDIENTE
- [ ] 28.06 · Usuarios fallecidos y correcciones — PENDIENTE
- [ ] 28.07 · Respaldo cifrado — PENDIENTE
- [ ] 28.08 · Acceso a copias — PENDIENTE
- [ ] 28.09 · Procedimiento de incidente — PENDIENTE

### 29. Backup restauración y desastre (P0) — 0/10

- [ ] 29.01 · Política de respaldos — PENDIENTE
- [ ] 29.02 · Exportación completa — PENDIENTE
- [ ] 29.03 · Restauración en proyecto desechable — PENDIENTE
- [ ] 29.04 · Integridad por conteos — PENDIENTE
- [ ] 29.05 · Integridad por hashes — PENDIENTE
- [ ] 29.06 · RPO/RTO medidos — PENDIENTE
- [ ] 29.07 · Restaurar decretos y notas — PENDIENTE
- [ ] 29.08 · Rollback de frontend — PENDIENTE
- [ ] 29.09 · Rollback de esquema — PENDIENTE
- [ ] 29.10 · Aislamiento entre parroquias — PENDIENTE

### 30. Despliegue y dependencias (P1) — 1/10

- [ ] 30.01 · Node y lockfile — PENDIENTE
- [ ] 30.02 · npm audit — FALLIDO
  - Evidencia: AUDITORIA_DEPENDENCIAS_V90.md: npm audit --omit=dev devuelve 8 avisos: 6 high, 2 moderate, 0 critical; pendiente remedación sin romper Tailwind
- [ ] 30.03 · CI automática — EN_PROGRESO
  - Evidencia: .github/workflows/sacramentum-auditoria-v90.yml: CI de tests build y npm audit creada y validada como YAML; falta ejecutarla en GitHub Actions
- [ ] 30.04 · Migraciones reproducibles — PENDIENTE
- [ ] 30.05 · Preview de Vercel — PENDIENTE
- [ ] 30.06 · Variables secretas — PENDIENTE
- [ ] 30.07 · Construcción de producción — PENDIENTE
- [x] 30.08 · Smoke posdespliegue — APROBADO
  - Evidencia: AUDITORIA_PUERTA_CALIDAD_V90.json: Puerta V90 ejecutó npm run build sin errores con Node del equipo; no certifica despliegue ni interfaz
- [ ] 30.09 · Git versionado — PENDIENTE
- [ ] 30.10 · Plan rollback — PENDIENTE

### 31. E2E de personajes ficticios (P0) — 0/10

- [ ] 31.01 · Diócesis de ensayo aislada — PENDIENTE
- [ ] 31.02 · Parroquias ficticias A y B — PENDIENTE
- [ ] 31.03 · Cuatro roles ficticios — PENDIENTE
- [ ] 31.04 · Bautismo a Confirmación — PENDIENTE
- [ ] 31.05 · Matrimonio y notificaciones — PENDIENTE
- [ ] 31.06 · Exequias y fallecido — PENDIENTE
- [ ] 31.07 · Decretos nuevos e históricos — PENDIENTE
- [ ] 31.08 · Doble click y red caída — PENDIENTE
- [ ] 31.09 · Impresión/estadística final — PENDIENTE
- [ ] 31.10 · Destruir sandbox y demostrar cero residuos — PENDIENTE

### 32. Auditoría forense de cierre (P0) — 0/10

- [ ] 32.01 · Versionar toda prueba — EN_PROGRESO
  - Evidencia: AUDITORIA_PUERTA_CALIDAD_V90.json: Gate registra ejecución 25 de 26, dependencias fallidas; falta cobertura integral por cada control
- [ ] 32.02 · Guardar entrada y expectativa — PENDIENTE
- [ ] 32.03 · Guardar resultado exacto — PENDIENTE
- [ ] 32.04 · Guardar capturas — PENDIENTE
- [ ] 32.05 · Rastrear hallazgos P0/P1/P2 — PENDIENTE
- [ ] 32.06 · Corregir y repetir — PENDIENTE
- [ ] 32.07 · Regresión completa — PENDIENTE
- [ ] 32.08 · Conteos antes/después — PENDIENTE
- [ ] 32.09 · Confirmar producción Ready — PENDIENTE
- [ ] 32.10 · Dictamen con limitaciones verificadas — PENDIENTE

## Hechos verificados previos al nuevo protocolo

- V89: 206/206 pruebas sintéticas, 23/23 verificadores anteriores y compilación OK; estos números no aprueban automáticamente el nuevo plan.
- Inventario SQL: 73/73 tablas públicas con RLS; 129 funciones SECURITY DEFINER ejecutables por authenticated y ninguna por anon.
- Seguridad V89: bloqueados INSERT, UPDATE y DELETE directos en decretos; concepto reservado a Cancillería; trazas restringidas.
- Pendientes: cinco ANULACION históricos, posible consecutivo supletorio de Bautismo ocupado, recorrido visual autenticado, restauración del respaldo.
- Supabase Advisors: revisión pendiente de advertencias GraphQL y RPC privilegiadas.

## Gestión del progreso

El JSON conserva un estado y evidencia por control. Este generador no sobrescribe el JSON cuando ya existe. Sólo marcar APROBADO después de una prueba verificable.

Comandos:

    cd C:\SACRAMENTUM\SACRAMENTUM_FINAL
    node scripts/audit-master-plan-v90.mjs
    node --test scripts/test-sistema-integral-v89.mjs scripts/test-chancery-decrees-v88.mjs scripts/test-supplementary-preflight-v89.mjs
    npm run build
