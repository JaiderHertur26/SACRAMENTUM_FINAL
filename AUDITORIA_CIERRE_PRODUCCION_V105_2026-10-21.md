# SACRAMENTUM V105 — Acta de publicación y pruebas de integridad

**Fecha local:** 21 de octubre de 2026, Colombia. **Repositorio:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`, rama `main`. **Commit de implementación:** `f13df5f`.

## Producción

- Despliegue Vercel: https://sacramentum-final-7ayd9hc4h-jaiderherreras-projects.vercel.app — **Ready in 13s**.
- URL oficial: https://sacramentum-final.vercel.app
- Rutas SPA `/`, `/chancery/decretos/archivo`, `/diocese/decretos/archivo` y `/parroquia/decretos/archivo` respondieron HTTP 200.
- CSS publicado: `/assets/index-CKKOgs_G.css`, 111.393 bytes, SHA-256 `B9C8839A3FD61ECC302251F0A90DB358BB211DE98D66E2584458587072453816`, idéntico a V104. No se modificaron componentes visuales.
- **Advertencia:** HTTP 200 en SPA no equivale a validación de pantallas o sesiones autenticadas.

## Corrección activa en Supabase

- Migración `verify_nullity_baptism_identity_v105`, archivo `supabase/migrations/20261022002722_verify_nullity_baptism_identity_v105.sql`, aplicada y validada.
- Una nulidad matrimonial ya no puede inscribir automáticamente anotaciones sobre un Bautismo cuyo nombre, apellidos y libro/folio/número no coincidan con los del contrayente en el expediente matrimonial.
- Se impiden duplicados y más de dos identificadores en `p_baptism_ids`.
- Se preservan la nulidad matrimonial sin vinculación bautismal automática y la notificación formal entre parroquias para vínculos documentalmente coherentes.

## Evidencia SQL real en transacciones reversibles

- **Prepatch:** se contaminó una partida bautismal ficticia de tercero no relacionado mediante una sentencia matrimonial también ficticia. Se deshizo.
- **Postpatch negativo:** intento análogo bloqueado; Matrimonio conservó estado y ninguna nota se generó.
- **Postpatch positivo:** dos Bautismos ficticios correspondientes a contrayentes, uno local y otro remoto en la misma diócesis. Resultado: Matrimonio `nullified`, **1 nota marginal local, 1 notificación remota, 1 destinatario pendiente**.
- **Postpatch complementario:** identificador duplicado y referencias bautismales incompletas bloqueados. El Matrimonio pudo registrarse sin `p_baptism_ids` cuando las referencias no podían verificarse.
- Postcondición: 0 Bautismos, Matrimonios, decretos, notificaciones, notas marginales y auditorías QA-V105 persistidos.

## Regresión y CI

- Puerta de calidad V105: **25/26** verificaciones correctas.
- **325/325 pruebas sintéticas** aprobadas, **23 verificadores históricos** correctos y compilación Vite aprobada.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39700570310
  - `pruebas-funcionales: SUCCESS`.
  - `seguridad-dependencias: FAILURE` por cinco HIGH todavía abiertos.
- Estos 325 tests sintéticos **NO** equivalen a los 325 controles de la auditoría maestra: la auditoría continúa con **9 APROBADO, 59 EN_PROGRESO, 256 PENDIENTE y 1 FALLIDO**.

## Riesgos abiertos

- Correspondencia jurídica exacta de identidades: los nombres y coordenadas cotejados no sustituyen verificar originales físicos ni una sentencia auténtica del Tribunal.
- Resolución de enlaces históricos sin referencias suficientes, y aceptación real de avisos entre parroquias.
- Auditoría de las demás funciones privilegiadas, concurrencia, respaldos restaurados y capturas de las pantallas autenticadas.
- Remediación de las cinco alertas HIGH de npm sin pérdida visual de Tailwind CSS 3.

**Informe detallado:** `AUDITORIA_NULIDAD_VINCULOS_BAUTISMO_V105_2026-10-21.md`.
