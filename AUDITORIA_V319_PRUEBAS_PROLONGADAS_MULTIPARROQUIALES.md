# SACRAMENTUM V319 — Pruebas prolongadas con parroquias
**Alcance:** pruebas reales de RPCs y persistencia transaccional en Supabase, entorno de datos actualmente NO oficiales.
**Principio operativo:** ninguna parroquia, usuario, partida, nota, decreto ni evidencia ficticia debe persistir. Todos los ensayos hacen `BEGIN` ... `ROLLBACK`.

## 1. Prueba nueva: notificación matrimonial entre tres parroquias
Archivo: `scripts/qa-rollback-multiparroquial-notificacion-v319.sql`.

Se provisionaron en una sola transacción dos parroquias ficticias operativas bajo una vicaría válida, dos identidades ficticias de `auth.users`, sus perfiles parroquiales y dos Bautismos con coincidencia verificable con un Matrimonio origen. La parroquia emisora utilizó el RPC auténtico `issue_sacramental_case_v277`, que generó dos destinatarios diferentes. El párroco B intentó procesar la notificación de C y fue rechazado; B asentó solo su nota, el segundo intento fue idempotente y la notificación siguió pendiente. El párroco C asentó su propia nota; solo entonces la correspondencia pasó a `processed`. Una segunda emisión del mismo Matrimonio fue rechazada.

**Evidencia de salida:** `complete=true`, 3 parroquias, 2 cuentas ficticias, 2 destinos, 2 notas, una denegación de ámbito, un reintento idempotente, cierre anticipado impedido, duplicación de emisión impedida, `rollback=true`.

## 2. Prueba nueva: Decreto de Repetición con tres parroquias
Archivo: `scripts/qa-rollback-multiparroquial-repeticion-v319.sql`.

Cancillería emitió, mediante el RPC real `issue_repetition_case_v314`, un decreto vinculado a tres partidas bautismales de un mismo sujeto ficticio: dos quedarían sin efectos registrales y una se conserva. Se generaron notificaciones a las tres parroquias. Se rechazó emitirlo desde un usuario parroquial; anotar un libro ajeno; certificar como físico un asiento digital; duplicar la anotación; cerrar una parroquia con nota obligatoria pendiente; y emitir como vigente la partida sin efectos. Se asentaron dos notas marginales individualizadas y se cerraron las tres actuaciones, hasta llegar a `completed_documentary`, preservando las inscripciones originales.

**Evidencia de salida:** `decree_issued=1`, `decree_notifications=3`, `marginal_notes=2`, `parish_resolutions=3`, `completed_documentary=true`, guardas de autorización/impresión verificadas, `rollback=true`.

## 3. Cuarta parroquia externa
Archivo: `scripts/qa-rollback-multiparroquial-repeticion-externa-v319.sql`.

Un cuarto destino externo exige una constancia individual con jurisdicción y referencia, registrada exclusivamente desde Cancillería. Se comprobó que tres respuestas internas NO completan el decreto; un párroco no puede registrar la constancia externa; tras la constancia de Cancillería el expediente sí pasa a `completed_documentary`; una segunda constancia de la misma parroquia externa se rechaza. `ROLLBACK` total.

## 4. Estrés reproducido
Las pruebas de las secciones 1 y 2 se ejecutaron **ocho rondas consecutivas cada una**, dando **16/16 ejecuciones completas aprobadas**. La variante externa también pasó una ejecución con operaciones reales y `ROLLBACK`. Un intento posterior de ampliar el estrés fue bloqueado por la herramienta; no se cuenta como ejecución ni como fallo de la aplicación.

## 5. Recuperación de pruebas heredadas V318
Cuatro casos que antes quedaban bloqueados por falta de varias parroquias/usuarios se ejecutaron, en esta ocasión con *fixtures transaccionales coherentes* y pasaron:
- V216 notas marginales de los 4 sacramentos: 4 notas, 4 rechazos de origen ajeno y 4 reintentos idempotentes.
- V216 guardia de notas por parroquia: ámbito ajeno denegado, procedencia preservada, reintento local seguro.
- V217 enlace matrimonial: destino ajeno rechazado, vínculo idempotente, origen protegido.
- V210 decretos documentales: 1 nuevo, 2 históricos, 2 lecturas legítimas, 0 lecturas interdiocesanas, 4 denegaciones de permisos/validación.

De los **8 casos heredados** con anomalías en V318, **4 quedan efectivamente resueltos y pasaron**. Los 4 restantes responden a contratos o expectativas antiguas: V179 intenta invocar un RPC cuya ejecución fue restringida; V141 y V143 no aportan el cotejo y huella obligatorios en V194; V197 exige que el obispo vea decretos parroquiales en contra de la política de privacidad actual. Deben reemplazarse por pruebas ajustadas al contrato vigente, no desactivar las protecciones.

## 6. Calidad permanente y datos intactos
- `scripts/test-v319-pruebas-prolongadas.mjs`: 7/7 pruebas de contrato local.
- Puerta `npm run audit:master`: **30/30** verificaciones aprobadas con la regresión V319 añadida a la misma lista que GitHub Actions; compilación Vite correcta.
- Auditoría de conteos tras el estrés: **6** parroquias existentes, **1** cuenta parroquial activa, 5.040 bautismos, 2.091 confirmaciones, 1.261 matrimonios, 1 exequia, 2 decretos, 82 notas marginales, 0 notificaciones matrimoniales, 2 oficiales, 365 eventos de auditoría y 9 eventos de impresión.
- **Cero** parroquias ficticias V319 y **cero** usuarios parroquiales QA persistentes después de las pruebas.

## 7. Por qué esto NO demuestra el 100% institucional
Se acredita la finalización de los escenarios V319 ensayados, **no** el 100% de la aplicación. Actualmente hay 4 parroquias operativas pero solo 1 cuenta parroquial real activa; falta validar autenticación real independiente, operaciones concurrentes reales de varias sesiones, envio/recepción de correspondencia externa verificable, y el inicio oficial de memoria de libros (`sacramentum_ledger.book_memories` tiene 0 filas, situación esperable antes de su inicialización). Supabase aún arroja advertencias de seguridad que requieren auditoría. La autorización sacramental oficial exige además limpieza institucional autorizada de todos los datos de prueba y validación canónica humana.

**Conclusión:** las funcionalidades interparroquiales y de Repetición ensayadas aprobaron; el sistema no debe declararse 100% apto para operación oficial hasta completar los aspectos indicados.
