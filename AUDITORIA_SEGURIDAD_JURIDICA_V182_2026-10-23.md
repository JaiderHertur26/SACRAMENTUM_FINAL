# SACRAMENTUM FINAL | V182 · Identidad jurídica y consultas de nulidad

Fecha: 23 de octubre de 2026 (Colombia). Ruta C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Hallazgo reproducido
Un usuario ficticio diocesano con is_active=true pero status=NULL pudo ejecutar tres RPC SECURITY DEFINER hasta alcanzar la validación de negocio, aunque current_app_role devolvía NULL. La reproducción no demostró una aprobación documental indebida ni abrió expedientes reales. Toda la evidencia SQL usa BEGIN/ROLLBACK.

## Protección
La migración oficial 20261024012204_juridical_reconciliation_identity_v182.sql ya instalada en Supabase modifica los tres controles institucionales para exigir u.is_active IS TRUE y upper(u.status)=ACTIVE: aprobación diocesana de conciliación posterior de notas, consulta de aclaraciones del tribunal y resumen de doble verificación de recepción judicial. En el resumen se rechaza expresamente v_role NULL. Se preservan requisitos jurídicos, validaciones de jurisdicción, documentación, firma, separación de funciones y contratos RPC.

## Prueba real y regresión
Con cuentas ficticias: cinco puertas permitidas con roles legítimos de Diócesis y Cancillería alcanzaron validaciones de entrada; 24 combinaciones no permitidas (SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, PENDING, BLANK_STATUS, WRONG_ROLE y PROFILELESS en cada función) fueron rechazadas con mensajes exactos.
19 nuevas pruebas contractuales Node. Total 1434/1434 pruebas sintéticas, 28/28 controles completos, Vite build, CSS y dependencias aprobadas.

## Límites
No son pruebas de aprobación completa de conciliación o lectura de expedientes legítimos; éstas requieren recorridos funcionales adicionales. No se usaron datos judiciales reales como material de prueba. Siguen abiertos el E2E con sesiones reales independientes y las conexiones SQL simultáneas. El plan maestro conserva 325 controles, 10 APROBADO, 117 EN_PROGRESO y 198 PENDIENTE.

Supabase V182 instalada y matriz PostgreSQL repetida: 5 controles legítimos y 24 rechazos; las tres funciones y el rechazo expreso de rol nulo comprobados; cero usuarios/perfiles ficticios residuales.
Cuatro regresiones adicionales pasaron: conciliación de notas, tribunal, doble autorización de nulidad y reconciliación de todos los sacramentos. Pendiente el CI definitivo de la PR, la fusión en main y la comprobación del SHA Vercel.
