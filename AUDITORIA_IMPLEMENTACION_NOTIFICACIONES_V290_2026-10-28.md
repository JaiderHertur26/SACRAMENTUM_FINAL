# SACRAMENTUM — Implementación integral de Notificaciones Sacramentales V290

Fecha: 2026-10-28 / 2026-10-29 (UTC).

## Alcance
El circuito V277 previo ya estaba **instalado en Supabase**, pero no conectado a `main`. Esta integración lo incorpora aditivamente sin sustituir las pantallas previas ni modificar `src/App.jsx`.

| Requisito | Implementación |
|---|---|
| 1. Misma parroquia | Matrimonio y Confirmación: una persona o dos personas con Bautismo digital local y nota registrada; Confirmación antigua también permite propia parroquia |
| 2. Misma parroquia sin Bautismo digital | Solicitud de búsqueda, localización del libro físico, certificación del asiento por la parroquia |
| 3. Otra parroquia registrada | Destino independiente por contrayente; recepción, búsqueda, vínculo digital o físico y aceptación |
| 4. Otra parroquia no registrada | Destino externo con parroquia, diócesis y medio de entrega |
| 5. Ambos contrayentes en parroquias distintas | Dos destinatarios independientes, no se completa hasta los dos |
| 6. Ambos en parroquias externas | Dos trámites externos independientes, devoluciones y evidencia por cada persona |
| 7. Aceptación interna y acuse | Bandeja existente, vinculación marginal, acuse individual RNS, documento consolidado para emisor y destinatarios por RPC V289 |
| 8. Devolución externa | Envío documentado y copia para remisión; devolución por correo/oficio con PDF/JPG/PNG privado (10 MB), fecha, referencia, certificación, visualización por URL temporal |

## Seguridad
- Libro, Folio y Número corresponden a la **partida bautismal** cuya nota se ejecuta; no se inventan ni asignan por este circuito.
- `public.guard_v277_case_completion` exige todas las personas acreditadas; ninguna cancelación equivale a aceptación.
- Bucket `sacramental-return-evidence` **privado**, con políticas RLS que llaman una función restrictiva V290 para evitar leer tablas privadas desde el cliente.
- Emisor y receptor pueden consultar expediente consolidado (V289); documentos adjuntos externos quedan visibles solo a la parroquia emisora mediante enlace temporal.
- Se conserva la ruta protegida anterior de Matrimonio con parámetro `?v277=1`, sin cambios a `App.jsx` ni a Cancillería.
- El archivo de notificaciones matrimonial antiguo no muestra expedientes V277 como documentos finales.
- Impresión preliminar distinguida como **copia para remisión / expediente no completado**; impresión final condicionada a estado procesado y todas las constancias.
- No se borraron ni alteraron partidas sacramentales de prueba.

## Validación
- 15/15 pruebas de matriz de casos V277 y 10/10 pruebas adicionales de integración V288.
- 61/61 pruebas focalizadas (seguridad, integridad, migraciones, notificaciones).
- Auditoría general 30/30 aprobada; compilación Vite correcta.
- Prueba real Supabase `BEGIN/ROLLBACK`: emisión de Confirmación a parroquia externa, intento de cierre sin acuse rechazado, archivo de evidencia y devolución, cierre correcto, consulta del documento compartido.
- Prueba real con `SET LOCAL ROLE authenticated`: el usuario parroquial pudo insertar en bucket tras reparar política V290. La política anterior dio `permission denied for table sacramental_external_returns_v277` y fue reparada antes de publicar.
- Los registros de prueba del proyecto permanecen; el producto no está declarado oficialmente habilitado.
- Migraciones instaladas: `20261029021505`, `20261029021716`, `20261029022546` y versionadas junto al código.

## Notas operativas
El documento adjunto externo se conserva de modo privado y se muestra a la parroquia emisora por URL temporal. El destino externo no recibe una cuenta; la evidencia se registra al regresar por el medio institucional. El flujo digital interno se completa por cada aceptación y nota marginal certificada, no solamente por marcar 'leído'.
