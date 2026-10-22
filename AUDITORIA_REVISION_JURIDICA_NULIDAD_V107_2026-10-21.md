# SACRAMENTUM V107 — Revisión jurídica de sentencia de nulidad

**Fecha:** 21 de octubre de 2026, Colombia. **Migración:** `20261022005935_nullity_judicial_review_intake_v107.sql`. **Ámbito:** Cancillería, Diócesis y Parroquia.

## Situación anterior

Tras completar los flujos de sentencia, avisos y notas marginales (V105–V106), se inspeccionaron las funciones existentes. No había un procedimiento especializado para *revocar una sentencia de nulidad matrimonial ya comunicada*. La función `reverse_marriage_decree` solo admite correcciones/reposiciones y no debe utilizarse para nulidades.

La base presenta **0 sentencias de nulidad matrimonial reales**, 0 notificaciones de ese tipo y 0 notas marginales asociadas a nulidades al comienzo del ensayo. Por tanto, no se simula una revocación jurídica efectiva sin una resolución verificable del Tribunal.

## Implementación segura de la primera etapa

La V107 habilita **abrir una solicitud formal de revisión jurídica**, no emitir una revocación.

Nueva tabla `public.nullity_judicial_review_cases`:
- Se vincula mediante FK a sentencia, Matrimonio, Diócesis y Parroquia.
- Conserva radicado de solicitud, referencia de documento de sustento, motivo detallado, solicitante, fecha y estado `pending_review`.
- Guarda instantánea de estado previo de la sentencia y Matrimonio y conteo de avisos, recepciones procesadas y notas marginales afectadas.
- Índice único parcial impide dos solicitudes abiertas para la misma sentencia.
- RLS de lectura: Cancillería y Diócesis de la jurisdicción, Parroquia propietaria; excluye al Administrador General.
- Ningún usuario tiene permisos directos de INSERT, UPDATE o DELETE; anon no tiene SELECT.

RPC `public.request_nullity_judicial_review_v107(uuid,text,text,text)`:
- Exige sesión activa de Cancillería, correspondencia de diócesis y parroquia real, sentencia `nulidad_matrimonial` activa de Matrimonio y partida original vinculada.
- Requiere radicado, referencia documental y motivo sustantivo (30 caracteres mínimo).
- Registra expediente, instantáneas y evento de `registry_audit_log`.
- **No** modifica decreto, Matrimonio, Bautismos, notas marginales, avisos ni acuses.
- La documentación aportada se describe por referencia; este paso **no acredita** por sí mismo que una sentencia judicial posterior sea auténtica.

## Integración en pantallas

- Cancillería / Archivo de Decretos: filtro **Tribunal / nulidades**; botón **Solicitar revisión jurídica** cuando la sentencia está vigente y no hay solicitud abierta. Tres solicitudes guiadas de datos y confirmación de que no se alteran partidas.
- Diócesis / Archivo: filtro Tribunal y lectura del radicado/estado sin edición.
- Parroquia / Archivo: filtro Tribunal y visualización del radicado/estado de la solicitud correspondiente a su parroquia, sin facultad de modificación.
- Se retiraron descripciones engañosas de «sin efecto registral» que podrían aplicarse visualmente a sentencias de nulidad.

## Pruebas reales de Supabase, exclusivamente datos ficticios

1. Se crearon temporalmente Matrimonio declarado nulo y decreto de nulidad ficticios, sujetos a `BEGIN/ROLLBACK`.
2. **Administrador General, Diócesis y Parroquia:** la RPC les denegó crear solicitud; **Cancillería** pudo registrarla.
3. La sentencia conservó estado `active` y el Matrimonio `nullified`. Registro de auditoría generado sin modificar ningún efecto.
4. Solicitud duplicada para la misma sentencia fue rechazada. Documento y motivo incompletos también rechazados.
5. **Visibilidad RLS:** Admin General 0; Diócesis 1, Cancillería 1 y Parroquia propietaria 1 (dentro de la transacción ficticia).
6. Comprobación posterior: **0 expedientes de revisión**, 0 decretos ficticios, 0 matrimonios ficticios y 0 eventos de revisión de prueba persistidos.
7. Grants reales: authenticated SELECT con RLS; INSERT/UPDATE denegados, anon SELECT/EXECUTE denegados.

Se añadieron **22 pruebas de regresión sintética** en `scripts/test-nullity-judicial-review-v107.mjs`, cubriendo integridad del esquema, control territorial, autoridad, estados, UI de tres roles y no mutación de partidas.

## Advertencias y tareas pendientes

La V107 implementa **solicitud y trazabilidad**, no decide, anula ni revoca sentencias. La decisión futura requiere diseño jurídico canónico validado y una resolución formal identificable, incluidas medidas de notificación y de conservación de todas las notas ya asentadas. Por ahora **no se permite revocación automática**.

Quedan pendientes: revisión documental real, procedimiento de decisión/ejecución basado en instrumento jurídico competente, recepción de avisos de revisión en parroquias remotas, pruebas de concurrencia y restauración de respaldos, capturas autenticadas de todas las pantallas, seguridad de las RPC restantes y cinco alertas HIGH de dependencias.
