# SACRAMENTUM — V160 · Auditoría visual interactiva del circuito de conciliaciones

## Alcance comprobado
- Se ejecutó el componente React real src/pages/chancery/LaterNoteReconciliationPage.jsx en Chrome Headless mediante CDP en servidor Vite aislado. El cliente Supabase, el usuario AuthContext y los RPC fueron reemplazados intencionalmente por mocks locales que no acceden a datos reales.
- Se probaron ambos roles institucionales SIMULADOS: Cancillería y Diócesis, con expedientes de prueba pendientes, autorizados, rechazados y ejecutados.
- Se probaron tres tamaños: móvil 390 × 844, tableta 768 × 1024 y escritorio 1365 × 900. Las seis renderizaciones mostraron cuatro expedientes, encabezado y controles del rol apropiados, sin overflow horizontal ni excepción de JavaScript.

## Interacción física automatizada con navegador
- Diócesis autorizó el expediente ficticio pendiente con referencia y motivo.
- Diócesis rechazó una solicitud pendiente.
- Diócesis revocó una autorización que todavía no estaba ejecutada.
- Cancillería ejecutó un expediente autorizado.
- Los cuatro clicks fueron enviados a la interfaz React real y llegaron exactamente una vez al servicio LOCAL simulado. Se actualizaron los estados en la UI; cuatro de cuatro aprobados.

## Evidencia persistida
- AUDITORIA_VISUAL_CONCILIACIONES_V160.json registra 6/6 vistas, dimensiones, roles, métricas, SHA256 y tamaños.
- AUDITORIA_EVIDENCIA_VISUAL_V160 contiene 6 capturas PNG provenientes directamente de Page.captureScreenshot de Chrome/CDP; capturas íntegramente sintéticas.
- AUDITORIA_INTERACCIONES_CONCILIACION_V160.json registra 4/4 acciones con historial, cambios y errores.
- scripts/audit-reconciliation-real-browser-v160.mjs, scripts/audit-reconciliation-clicks-v160.mjs y scripts/qa-v160-browser/ dejan el harness de reproducción.
- scripts/test-browser-reconciliation-v160.mjs integra 15 validaciones al Quality Gate y CI.

## Incidencias del banco QA
- La primera ejecución dio 0/6 porque la configuración Vite cargó inadvertidamente el cliente real Supabase (se detuvo por no encontrar las variables de despliegue); el mock tenía además un cierre sintáctico incorrecto.
- Se corrigieron los alias y el archivo de mocks; se repitió la sesión integral. Solo el resultado final 6/6 y 4/4 cuenta como aprobado. No hubo escrituras a Supabase.

## Resultados de calidad e inventario
- 1072/1072 pruebas sintéticas; 28/28 controles.
- Compilación de producción y validación CSS correctas. npm audit producción y dependencias completas reportaron 0 vulnerabilidades.
- Inventario de privilegios sin migraciones: 206 SECURITY DEFINER, 145 ejecutables authenticated, 35 con evidencia parcial y 110 pendientes.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}; 14 controles con nueva evidencia, ninguno ascendido a aprobación artificial.

## Limitaciones y pendientes que NO se dan por certificados
- La prueba visual usó usuarios institucionales simulados y un servidor local. No hubo inicio de sesión real con las identidades de Cancillería y Diócesis y no se usó el backend con datos reales desde Chrome.
- La concurrencia PostgreSQL entre dos transacciones y sus locks FOR SHARE/FOR UPDATE no fue demostrada; los intentos con el servicio de SQL no certifican superposición.
- El nuevo frontend tampoco se desplegó a Vercel en esta intervención.

**Dictamen:** navegación visual aislada y acciones de React aprobadas con evidencia reproducible. Prueba E2E autenticada y concurrencia real siguen pendientes.
