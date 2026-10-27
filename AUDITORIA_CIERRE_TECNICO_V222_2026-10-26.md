# SACRAMENTUM FINAL — Cierre técnico V222

**Fecha:** 26 de octubre de 2026. **Proyecto local:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Premisa indispensable
**TODOS los registros actualmente cargados son de prueba y NO son oficiales.** Ninguna intervención V222 modifica partidas, crea actos eclesiásticos, actualiza datos o realiza migraciones en Supabase.

## Mejora técnica
La V222 corrige riesgos de **filtración visual y acciones heredadas entre sesiones parroquiales** en las tres rutas de correspondencia:

1. **Bandeja de notificaciones sacramentales** `src/pages/parish/SacramentalNotificationsPage.jsx`: exige un perfil activo de parroquia; monta una instancia independiente por identidad/territorio; descarta respuestas asíncronas obsoletas de la bandeja; protege apertura de avisos y acuses; exige pertenencia del registro cargado antes de permitir confirmar recepciones o asientos físicos.
2. **Comunicaciones oficiales de decretos** `src/pages/parish/ParishNotificationsPage.jsx`: cambia de instancia al variar cuenta, perfil, parroquia o diócesis; conserva la cancelación de solicitudes antiguas; comprueba que el aviso seleccionado siga en la bandeja actual.
3. **Emisión de notificación de Confirmación** `src/pages/parish/ConfirmationNotificationPage.jsx`: impide emisión desde un contexto obsoleto, exige que Confirmación y destinatario estén en el contexto autorizado y descarta respuestas tardías tras cambiar de identidad.
4. **Protección compartida** `src/utils/parishSessionScope.mjs`: valida usuario autenticado, perfil activo, rol parroquia, identidad coincidente y alineación de jurisdicción. No consulta localStorage ni credenciales proyectadas como autoridad independiente.

Los controles de interfaz son una defensa adicional. La **autoridad de escritura** permanece en Supabase Auth, RLS y RPC; no debe inferirse que la protección client-side suple dichas garantías.

## Auditoría reproducible
- **1.946 / 1.946** ensayos sintéticos integrales aprobados (incluidos **25 nuevos** controles V222).
- **8 / 8** escenarios de Chromium aislado, con las tres páginas React reales y respuestas artificialmente retardadas: intercambio A→B, llegada tardía de A, cierre de diálogos antiguos, cuenta suspendida, decretos de otra parroquia, Confirmación ajena y envío sin selección autorizada.
- **30 / 30** verificaciones de la puerta de calidad, incluyendo compilación de producción y dependencias sin hallazgos.
- **0** excepciones JavaScript en esos ocho escenarios; solicitudes externas bloqueadas y sin tráfico a Supabase real.
- Los ensayos están integrados a GitHub Actions mediante `scripts/audit-parish-notification-session-browser-v222.mjs` y `scripts/test-parish-notification-session-v222.mjs`.

## Archivos de evidencia
- `AUDITORIA_NOTIFICACIONES_SESIONES_BROWSER_V222.json`
- `AUDITORIA_PUERTA_CALIDAD_V222.json`
- `AUDITORIA_AVANCE_GLOBAL_V222.json`

## Límites pendientes
No se considera certificada la operación real de todas las rutas con sesiones autenticadas multirrol, la entrega real de correo, la impresión física, la carga bajo estrés ni la conciliación de vínculos históricos de V219 (46 candidatos por cotejar, 1 conflicto y 172 referencias no localizadas). El uso oficial requiere una segregación expresa de los registros ficticios y autorización institucional.

## Porcentaje estimado
**91 %**, según ponderación de nueve áreas: **90,52 %**, redondeado. Es una **estimación técnica**, nunca una garantía de funcionamiento completo.
