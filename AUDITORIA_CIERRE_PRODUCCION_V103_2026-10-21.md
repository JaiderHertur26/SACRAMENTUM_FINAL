# SACRAMENTUM V103 — Acta de publicación y evidencia final

**Fecha:** 21 de octubre de 2026. **Estado:** despliegue Ready, GitHub sincronizado y pruebas funcionales aprobadas. **No equivale a certificación integral de SACRAMENTUM.**

## Versiones aplicadas y publicadas

- V102: `institutional_document_authority_v102`. El Administrador General ya no puede emitir/anular documentos parroquiales o diocesanos ni crear nuevas versiones de sus plantillas. Se mantienen emisión, anulación y plantillas legítimas de Parroquia, Diócesis y Cancillería, y las plantillas `system` de Administrador General.
- V103: `reserve_historical_reconciliation_to_service_v103`. Dos funciones de reconciliación histórica de alto impacto pasaron a acceso exclusivo de propietario/servicio. No se ejecutaron ni alteraron reconciliaciones reales.
- Supabase: se validaron directamente las funciones y se ejecutaron pruebas de roles con registros ficticios reversibles para V102.
- Avisos de seguridad de Supabase tras V103: **126** SECURITY DEFINER ejecutables por `authenticated`, **60** alertas GraphQL y **1** advertencia de leaked-password protection. Un aviso no equivale a una vulnerabilidad explotable confirmada.

## Compilación y automatización

- Commit V102: `4994748`.
- Commit V103: `ca0d4dc`.
- Rama `main` sincronizada con `origin/main`.
- Puerta de calidad V103: **25/26** verificaciones operativas aprobadas, **300/300 pruebas sintéticas**, **23 verificadores históricos** y build Vite correcto.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39682883148
  - `pruebas-funcionales`: SUCCESS.
  - `seguridad-dependencias`: FAILURE. Se mantienen **cinco avisos HIGH** de npm audit; no se relaja el umbral.

## Producción Vercel comprobada

- Despliegue: https://sacramentum-final-qy48nilez-jaiderherreras-projects.vercel.app — Ready.
- URL pública: https://sacramentum-final.vercel.app.
- HTTP 200 en `/`, `/chancery/decretos/archivo`, `/diocese/decretos/archivo`, `/parroquia/decretos/archivo` (solo confirma disponibilidad de SPA, no UI autenticada).
- CSS realmente servido: `/assets/index-CKKOgs_G.css`, 111.393 bytes; SHA256 `B9C8839A3FD61ECC302251F0A90DB358BB211DE98D66E2584458587072453816`, idéntico al de V101.

## Plan maestro de 325 controles

**9 APROBADO, 57 EN_PROGRESO, 258 PENDIENTE, 1 FALLIDO**.

Las vulnerabilidades V102 fueron reproducidas y corregidas con una matriz negativa/positiva. Las funciones V103 fueron cerradas preventivamente basándose en sus grants y código; no se ejecutaron contra datos históricos reales. Las dos cosas se diferencian expresamente para no crear conclusiones infladas.

## Trabajos que siguen pendientes

- Auditar individualmente las 126 RPC privilegiadas ejecutables por `authenticated`.
- Resolver los cinco avisos HIGH sin migración visual regresiva.
- Revisar roles y permisos de emisión física/impresión, cuadros de decretos y conservación de documentos originales.
- Pruebas completas desde las pantallas autenticadas en cada rol, simultaneidad y restauración de respaldo en un entorno separado.
- Validación jurídico-eclesiástica sobre los libros y decretos, que requiere cotejo con documentación oficial.

**Informes:** `AUDITORIA_DOCUMENTOS_OFICIALES_V102_2026-10-21.md`, `AUDITORIA_RECONCILIACIONES_PRIVILEGIADAS_V103_2026-10-21.md`.
