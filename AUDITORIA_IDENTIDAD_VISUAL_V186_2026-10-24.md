# SACRAMENTUM V186 — Imagen institucional Arquidiócesis de Barranquilla
Fecha: 24 de octubre de 2026 · proyecto local: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Solicitud implementada
- Portada pública: retirado el título "Plataforma Eclesial Unificada" y el párrafo genérico. En su lugar, identidad de Arquidiócesis de Barranquilla con emblema proporcionado por el usuario, trazado a SVG escalable, fondo azul profundo, marco de arco dorado y título institucional.
- Columna de acceso: fondo perla/blanco/azul, arcos sutiles, divisores dorados, campos con bordes azules suaves y botón de acceso dorado; conserva la autenticación Supabase, el registro de primer acceso y recuperación de clave originales.
- Entornos privados: tarjeta en Sidebar persistente en todas las rutas de Diócesis/Arquidiócesis, Cancillería y Parroquia. El emblema se muestra sólo si pertenece al identificador institucional autenticado de Barranquilla (Supabase ID: 452d50bc-ff3e-448e-9b93-1e97f8d321e2).
- Cuentas fuera de la Arquidiócesis, Administrador General, perfiles sin activación y usuarios sin jurisdicción validada no ven la tarjeta.
- La parroquia obtiene la jurisdicción desde `parishes.diocese_id` y verifica coherencia si el perfil tiene `diocese_id`. Arquidiócesis/Cancillería obtienen identificación desde `dioceses.id`. La marca es visual; no concede permisos ni modifica RLS.

## Evidencia de navegador y regresión
- Browser CDP Chrome/Edge real, sin login ni operaciones sacramentales: escritorio 1440×900, tableta 768×1024 y móvil 390×844; **3/3** PASS, logo descargado, formulario presente, título anterior ausente, no overflow horizontal, **0** excepciones JS.
- Evidencia local: `AUDITORIA_IDENTIDAD_BROWSER_V186.json` y `AUDITORIA_EVIDENCIA_IDENTIDAD_V186/` (capturas sin datos privados).
- 6 pruebas unitarias específicas de jurisdicción, perfiles inválidos y vínculos institucionales, incluidas en la puerta.
- Gate V186: **1.455/1.455** Node, **30/30** verificaciones, build y auditoría de dependencias OK; cero alertas de secretos detectados en compilación con control V183.

## Límites
Estas pruebas verifican el diseño público en navegador y la decisión de marca institucional en código. No declaran probado un recorrido autenticado visual con tres perfiles reales independientes de Barranquilla; sigue pendiente dentro de la auditoría integral. No hay cambios de esquema ni datos de producción.

**Estado global de auditoría:** se mantiene en 13 controles formalmente aprobados de 325. Esta entrega es una mejora de identidad, no equivale a cerrar controles pendientes de seguridad y E2E.
