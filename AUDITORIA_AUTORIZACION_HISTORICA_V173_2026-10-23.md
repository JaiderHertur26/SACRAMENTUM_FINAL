# SACRAMENTUM · V173 — Aislamiento de la digitalización histórica

Fecha: 23 de octubre de 2026. Ruta principal: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Hallazgo de seguridad reproducido
La función interna de registro histórico de Bautismo comprobaba que el actor fuera parroquial y perteneciera a la parroquia, pero aceptaba `status=SUSPENDED` cuando `is_active=true`; su lista de tres estados denegados no incluía suspensión. Una cuenta ficticia con esta configuración digitalizó una partida ficticia y dejó un evento de auditoría dentro de la transacción, revertidos con `ROLLBACK`.

La misma cláusula débil existía en los registros históricos de Confirmación, Matrimonio, Exequias, asientos narrativos y en la función pública de Confirmación. No afirmamos que se explotaran físicamente las otras cinco funciones antes del parche: quedaron acreditadas por examen directo del SQL.

## Reparación integral
Migración `20261023194004_guard_historical_baptism_active_parish_v173.sql`:
- Afecta exclusivamente seis funciones SQL preexistentes (cinco flujos históricos, incluida entrada de Confirmación).
- Requiere `is_active IS TRUE`, `status=ACTIVE` y asociación comprobada entre la diócesis del perfil y la parroquia objetivo; conserva el filtro parroquial existente.
- Preserva coordenadas físicas Libro/Folio/Número, autorización diferenciada, firma RPC, auditoría y permisos. Aborta si cambian las firmas o las cláusulas esperadas.

## Evidencia
- `scripts/qa-rollback-historical-baptism-suspended-repro-v173.sql`: defecto Bautismo confirmado antes de parche, todo ficticio y revertido.
- `scripts/qa-rollback-historical-baptism-active-parish-v173.sql`: parche temporal rechazó SUSPENDED, rechazó diócesis incorrecta y permitió un registro Bautismo legítimo de ficción con exactamente un evento de auditoría.
- `scripts/qa-rollback-historical-four-workflows-v173.sql`: ocho rechazos correctos de perfiles suspendidos o interdiocesanos en Confirmación, Matrimonio, Exequias y asientos narrativos.
- Otros seis guiones históricos de permisos y documentación, seleccionados en esta pasada, aprobaron en SQL real con transacciones reversibles.
- 15 pruebas contractuales nuevas en Node; 1277/1277 sintéticas y 28/28 comprobaciones generales aprobadas.

## Verificación de instalación
Supabase registró la migración oficial 20261023194004. Se repitieron los dos guiones SQL reversibles contra las funciones ya instaladas; ambos aprobaron. Las seis definiciones privilegiadas contienen la validación estricta de estado y diócesis. Los recuentos de usuarios ficticios, Bautismos ficticios, diócesis ficticias y trazas de auditoría QA-V173 residuales son cero.

## Límites
No certifica el alta legítima a través del navegador en todos los módulos, ni dos sesiones Supabase reales separadas, ni concurrencia simultánea PostgreSQL. Los datos QA no se persistieron. Se conserva el plan maestro: {"APROBADO":10,"EN_PROGRESO":117,"PENDIENTE":198}.

**Dictamen V173:** vulnerabilidad real de Bautismo corregida en Supabase y seis funciones históricas reforzadas, con repetición positiva de las pruebas SQL. La publicación GitHub/Vercel solo se declarará al confirmar el mismo commit.
