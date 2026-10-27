# SACRAMENTUM FINAL — V227 · AUTENTICACIÓN REAL Y ACEPTACIÓN CON USUARIOS FICTICIOS

## Protocolo seguro
**Todo dato actual es exclusivamente de prueba; nada se trasladará a la futura instalación oficial.** Se utilizaron cuentas de QA `@example.invalid` con credenciales privadas fuera del repositorio. El inicio de sesión fue **REAL mediante Supabase GoTrue**, sin fabricar tokens JWT.

No se crearon ni eliminaron cuentas en V227. El ensayo de recuperación **cambió la contraseña de una sola cuenta ficticia**, conservando la nueva credencial solamente en la configuración privada; la prueba de suspensión de perfil restauró su estado al terminar. Todas las pruebas de concurrencia sacramental se ejecutaron mediante procedimientos de QA que hacen `ROLLBACK` deliberado y comprueban que no persistan partidas ni cambios de numeración.

## Matriz V227 completada con resultados reales
- **8/8 cuentas GoTrue:** contraseña válida, `getUser()`, lectura RLS de perfil y correspondencia del rol institucional. Una contraseña errónea fue denegada.
- **25/25 intentos fuera de jurisdicción o rol:** 24 negativas al crear borradores de Bautismo, Confirmación, Matrimonio y Exequias, más una negativa de administración de usuarios fuera de diócesis. Todas se realizaron llamando RPC protegidas con sesiones autenticadas de prueba.
- **4/4 sesiones en la aplicación React auténtica**: formulario de login, panel de Parroquia, Diócesis, Cancillería y Administrador General, restauración tras recarga y rechazo de ruta de otro rol. Cero excepciones de navegador y cero solicitudes a destinos externos no autorizados.
- **5/5 ensayos de concurrencia**: dos cuentas reales y dos procesos PostgreSQL, operaciones de Bautismo, Confirmación, Matrimonio, Exequias y operaciones vinculadas; recuperación de deadlock `40P01` comprobada, parámetros y consecutivos sin residuos.
- **4/4 ensayos de resiliencia de sesión**: salida normal, fallo de red durante salida, bloqueo/restablecimiento institucional y respuesta de perfil tardía tras un nuevo inicio de sesión.
- **1/1 modificación de contraseña**: una cuenta ficticia actualizó su contraseña, se rechazó la anterior, se aceptó la nueva y el doble envío no produjo más de una operación.
- Postverificación privilegiada: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia; 12 cuentas, con 8 perfiles QA208 activos. Los datos permanecen **NO OFICIALES**.

## Evidencia redaccionada y CI
- `AUDITORIA_AUTH_SESIONES_REALES_V227.json` guarda exclusivamente totales, resultados, límites y SHA256 de fuentes revisadas; **no contiene contraseñas, tokens, correos ni UUID de usuarios**.
- `scripts/compile-real-auth-evidence-v227.mjs`: se ejecuta manualmente en el equipo autorizado **solo después** de repetir las pruebas QA auténticas. Lee informes locales V208 no redactados y produce exclusivamente evidencia V227 segura, sin copias de datos personales.
- `scripts/test-real-auth-evidence-v227.mjs`: comprueba los 12 supuestos de aceptación y la huella de la aplicación. Se añade al gate principal de calidad y GitHub Actions. El CI valida la **evidencia histórica**, no se conecta a QA ni reclama un nuevo login.
- Los archivos V208 regenerados con identificadores personales durante el ensayo se restauran al estado anterior del repositorio; el nuevo corte V227 publicado contiene solo el informe saneado.

## Pruebas ejecutadas manualmente
```powershell
Set-Location 'C:\SACRAMENTUM\SACRAMENTUM_FINAL'
# Solo en el equipo QA autorizado, con configuración privada en TEMP:
node scripts/audit-live-auth-v208.mjs
node scripts/audit-live-auth-jurisdictions-v208.mjs
node scripts/audit-live-app-auth-v208.mjs
node scripts/audit-live-concurrency-v208.mjs
node scripts/audit-live-auth-resilience-v208.mjs
node scripts/audit-live-password-reset-v208.mjs
node scripts/compile-real-auth-evidence-v227.mjs
```

## No cubierto todavía
No se ha verificado la **entrega externa real de correo ni SMTP**, la restauración formal de respaldos, la firma/impresión física de documentos, un circuito positivo completo de decretos con aprobación oficial, ni la creación de **un nuevo proyecto Supabase vacío**. Persiste la revisión administrativa de privilegios `supabase_admin` y el análisis exhaustivo de 152 RPC SECURITY DEFINER antes del lanzamiento.

**La aplicación V227 sigue en modo QA. Ninguna partida puede considerarse oficial.**
