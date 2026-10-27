# SACRAMENTUM FINAL — AUDITORÍA DE CIERRE V227
**Fecha:** 26 de octubre de 2026 (Colombia, resultados UTC 27/10/2026). **Carpeta:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Resultados de esta etapa: ejecución REAL con usuarios ficticios
Se reutilizaron ocho cuentas GoTrue ya existentes y mantenidas en una configuración privada fuera del repositorio, sin simular inicios de sesión. Las pruebas se realizaron contra la base Supabase actual **exclusivamente QA**.

- **8/8 cuentas** iniciaron sesión mediante contraseña real y recuperaron su identidad y proyección institucional; contraseña incorrecta rechazada.
- **25/25 intentos de acceso prohibido** denegados desde RPC reales, incluyendo **24/24** creaciones cruzadas de borradores de los cuatro sacramentos con el código de PostgreSQL `42501` y una alteración de cuenta de una diócesis ajena.
- **4/4 recorridos del formulario React real**: Parroquia, Diócesis, Cancillería, Administrador General; reingreso tras recargar y protección de rutas no autorizadas. Cero excepciones de Chrome y cero solicitudes externas inesperadas.
- **5/5 pruebas reales de concurrencia** con dos identidades y sesiones PostgreSQL distintas: Bautismo, Confirmación, Matrimonio, Exequias y registros vinculados. Detectada y recuperada situación controlada de deadlock `40P01`. Los procedimientos de QA terminaron en `ROLLBACK`, sin residuos de consecutivos.
- **4/4 pruebas de sesión y bloqueo**: cerrar sesión con/sin red, suspensión y reactivación de perfil, petición de perfil atrasada tras login posterior.
- **1/1 cambio efectivo de contraseña** de cuenta ficticia: se denegó la contraseña antigua, se aceptó la nueva y el doble envío no duplicó el cambio. El nuevo secreto quedó solo en fichero privado fuera del repositorio.

### Preservación de la base de ensayo
Consulta posterior verificada: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia; 12 cuentas, ocho perfiles QA208 activos. **Los datos siguen siendo ficticios.** La rotación de contraseña de QA sí cambió credenciales de esa cuenta de prueba; no se realizó ninguna oficialización.

### Seguridad de los resultados
Los reportes V208 completos —que pueden contener identificadores de cuentas— quedaron solo en la máquina autorizada y se restablecieron a la versión ya controlada por Git antes de subir V227. La evidencia publicable `AUDITORIA_AUTH_SESIONES_REALES_V227.json` incluye únicamente agregados, marcas de origen, límites y huellas SHA256 de los archivos de autenticación. Nunca se subieron nuevos JWT, contraseñas, correos, UUID de perfil ni claves privadas. La auditoría real se puede repetir manualmente siguiendo `RUNBOOK_AUTENTICACION_REAL_V227.md`.

### Puerta de calidad
- **2.052 / 2.052** pruebas sintéticas aprobadas, incluidas **12 nuevas pruebas V227**.
- **30 / 30** verificaciones de calidad, compilación y análisis de dependencias aprobados.
- GitHub CI verifica las regresiones de evidencia **sin acceder a QA ni ejecutar pruebas con credenciales privadas**. El modo oficial continúa bloqueado por V226.

### Lo que no se da por finalizado
Aún faltan: corregir los permisos del propietario `supabase_admin` bajo administración legítima; inspección exhaustiva de las 152 funciones `SECURITY DEFINER`; aceptar el flujo positivo completo, documental y jurídico de los cuatro sacramentos y sus decretos; restauración de respaldos probada, entrega SMTP externa y prueba física de impresiones. También se necesita **crear y certificar una instalación Supabase NUEVA, VACÍA, separada de los datos de prueba**, con el acta institucional de apertura. Nada de la base QA se transferirá.

**Avance global técnico estimado: 95 %** (94,90 % ponderado, redondeado). Esta cifra no es certificación legal ni autorización de producción.
