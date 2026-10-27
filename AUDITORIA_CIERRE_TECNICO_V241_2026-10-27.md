# SACRAMENTUM FINAL V241 — Segunda tanda real de fortalecimiento de perfiles activos

**Fecha:** 27/10/2026. **Entorno QA ficticio:** `foczofcmwampjvlfbsqn`. Sin uso oficial.

## Hallazgos y corrección real en Supabase
En la revisión V240 se identificaron posibles condiciones permisivas de `is_active` y `status`. Se confirmaron y corrigieron cuatro rutas expuestas `SECURITY DEFINER`:

1. `save_funeral_parameters` (numeración, controles y parámetros de Exequias).
2. `save_marriage_parameters` (numeración y configuración de Matrimonios).
3. `search_baptisms_for_matrimonial_notification` (lectura de partidas para notificaciones matrimoniales).
4. `void_document_issuance` (anulación de documentos expedidos).

La migración `supabase/migrations/20261027114000_harden_four_active_profile_rpcs_v241.sql` cambia **solo el guard de identidad**, conservando la autorización posterior de ámbito institucional. Los perfiles que se consideran válidos ahora deben tener `is_active IS TRUE` y `upper(coalesce(status,''))='ACTIVE'`. Las cuatro definiciones reales QA fueron inspeccionadas posteriormente mediante `pg_proc` y ninguna conserva el antiguo `coalesce(is_active,true)`.

Se preservaron nombres, firmas, privilegios y lógica de dominio de las cuatro RPC. Se observaron 7 resultados de pruebas QA usando cuentas ficticias: 4 accesos de roles ajenos denegados; una consulta parroquial sin criterios rechazada; una consulta parroquial sin coincidencias aceptada con 0 resultados; y anulación de documento inexistente rechazada. Ninguna operación válida de escritura fue ejecutada. En el ensayo de documento inexistente se usó transacción con reversión explícita porque el procedimiento bloquea filas con `FOR UPDATE`.

**No se modificaron partidas ni usuarios:** 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia y 12 cuentas QA. Permanecen 152 funciones privilegiadas expuestas; su huella canónica PostgreSQL pasó de `d68b18810533c368d26f2c43e2ea9711` a `2271708267b8e801367bc282d146d49e`. El guard de publicación se actualizó para rechazar atestaciones con la huella anterior. Los registros de evidencia V236 y V240 permanecieron históricos y sin reescribir.

La migración 161 quedó incluida en el manifiesto inmutable de esquema. El número de migraciones con DML histórico permanece en **14** y el número de sentencias históricas clasificadas permanece **45**, incluyendo 39 que no deben reproducirse sobre bases oficiales y 6 de catálogo que requieren revisión.

## Riesgos que no se declaran resueltos
Se requiere continuar el análisis semántico de otras funciones con patrones de actividad débil, individualizando aquellas donde ya hay un control estricto alternativo. Estas cuatro correcciones, sumadas a las dos de V240, **no validan automáticamente las 152 RPC** ni los flujos de decretos válidos. Faltan la base aislada de producción, restauración certificada, configuración SMTP, documentos impresos y aceptación institucional.

**Avance técnico estimado conservado:** 97,41 %. **Uso oficial:** bloqueado.
