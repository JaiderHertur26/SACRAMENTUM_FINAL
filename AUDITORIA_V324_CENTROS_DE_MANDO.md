# SACRAMENTUM V324 · Centros de mando eclesiales

Los inicios de los cuatro roles reúnen sus herramientas en una presentación común: marfil, vino y oro, títulos de inspiración editorial e identidad institucional existente. Cada área abre un panel de acciones; los enlaces conducen a las pantallas actuales.

| Rol | Áreas principales |
| --- | --- |
| Parroquia | Bautismo, Confirmación, Matrimonio, Exequias y accesos del despacho |
| Diócesis / Arquidiócesis | Organización eclesiástica, informes sacramentales, migración y comunicación |
| Cancillería | Decretos, expedientes pendientes, revisión histórica y comunicación |
| Administración General | Jurisdicciones, usuarios institucionales, migración, seguridad y respaldos |

Se conservan los formularios, el membrete de Cancillería, las notificaciones de decretos asentados, la revisión institucional, la actividad reciente y la gestión de jurisdicciones. Los controles de acceso permanecen en las rutas protegidas y en el servidor. El estilo administrativo se activa en su centro de mando; las demás pantallas conservan su presentación actual.

Los resúmenes usan las lecturas existentes. Una lectura fallida se presenta como un error y sus valores como una raya, evitando mostrar ceros como si fueran datos confirmados. Los paneles de acciones manejan el foco y pueden cerrarse con Escape.

## Validación

- 256/256 comprobaciones en Chrome sobre los cuatro dashboards reales con perfiles, datos y servicios ficticios aislados.
- Veinte combinaciones: cuatro roles por cinco anchuras (1440, 1024, 820, 390 y 320 píxeles).
- Paneles, enlaces, destino de navegación, foco, Escape, apertura y cancelación del membrete, y errores de lectura.
- Cero excepciones JavaScript, cero solicitudes a servicios externos y cero escrituras en el ensayo.
- Ocho capturas de escritorio y móvil; revisión visual de los cuatro roles.
- Catorce archivos de fuente vinculados a la evidencia mediante SHA-256 con finales de línea normalizados.
- Ocho pruebas nuevas de integración, rutas por rol, conservación de accesos, contraste y correspondencia de evidencias.
- Puerta general: 30/30 verificaciones; compilación, frontera de secretos, CSS crítico y auditorías npm sin vulnerabilidades.

El ensayo del navegador utiliza servicios simulados y no se presenta como una prueba con sesiones institucionales reales. No se modificaron tablas, políticas, autorizaciones del servidor ni operaciones sacramentales.

## Evidencias y reproducción

- AUDITORIA_CENTROS_DE_MANDO_V324.json
- AUDITORIA_EVIDENCIA_CENTROS_V324/
- AUDITORIA_PUERTA_CALIDAD_V324.json

Desde el repositorio con sus dependencias instaladas:

    node scripts/audit-command-centers-browser-v324.mjs
    node scripts/audit-gate-v90.mjs --protocol=V324 --output=AUDITORIA_PUERTA_CALIDAD_V324.json

La revisión de navegador de los cuatro centros también forma parte de GitHub Actions. La publicación sigue el despliegue existente de Vercel para main.
