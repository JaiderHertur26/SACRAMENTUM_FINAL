# SACRAMENTUM FINAL V98 · Acta de publicación y verificación

**Fecha:** 21 de octubre de 2026. **Commit implementado:** `28fc443`. **Rama:** `main`. **Ruta del proyecto:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Producción

- Vercel reportó **Ready** para el despliegue `https://sacramentum-final-hq3c7fj88-jaiderherreras-projects.vercel.app`.
- Alias productivo: https://sacramentum-final.vercel.app
- Comprobación de rutas SPA: `/`, `/chancery/decretos/archivo`, `/chancery/decretos/documental`, `/parroquia/decretos/archivo` → HTTP 200.
- **Limitación:** HTTP 200 en SPA no acredita la autorización o representación del contenido autenticado.

## Construcción y diseño

- Build Vite `npm run build` → OK.
- CSS desplegado: `/assets/index-CKKOgs_G.css`, 111.393 bytes.
- SHA-256 verificado del CSS productivo: `B9C8839A3FD61ECC302251F0A90DB358BB211DE98D66E2584458587072453816`.
- Comparación selectores CSS con V96: **1.533 anteriores conservados**, una clase adicional `max-w-24`, **0 clases retiradas**. La clase nueva se aplica a la etiqueta de histórico protegido.
- Debe realizarse la comprobación de la pantalla de Cancillería en sesión autenticada, con captura y contraste visual.

## Validación de seguridad y procedencia

- Migración V97: `reserve_decree_concepts_to_chancery_v97`, aplicada correctamente en Supabase. Solo Cancillería puede insertar o modificar conceptos en su diócesis.
- Migración V98: `lock_legacy_concept_provenance_v98`, aplicada correctamente en Supabase. El contenido y origen de catálogos históricos no se pueden sobrescribir; se permite desactivar.
- Pruebas de autorización y de procedencia: resultado positivo conforme a `AUDITORIA_CONCEPTOS_DEC_REGLAS_V98_2026-10-21.md`.
- Estado final: **4 conceptos históricos intactos, 0 registros ficticios, 0 diócesis ficticias, 1 trigger de protección, 0 bypass `is_app_admin()` en escritura de conceptos**.

## Puerta de calidad y GitHub Actions

- Puerta local V98: **25/26 controles de ejecución** aprobados. El único fallido es `dependencias-externas` por cinco avisos HIGH.
- Batería de pruebas sintéticas `node --test`: **264/264 aprobadas**.
- 23 verificadores históricos aprobados; build y control de utilidades CSS aprobados.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39668757586
  - **pruebas-funcionales: SUCCESS**.
  - **seguridad-dependencias: FAILURE esperado** (`npm audit --omit=dev --audit-level=moderate`).
- Supabase Security Advisors: **128** avisos por SECURITY DEFINER ejecutables desde authenticated, **60** por superficies de GraphQL y **1** por leaked-password protection. Son advertencias; no afirmar 128 vulnerabilidades comprobadas.

## Estado del plan de 325 controles

- **9 APROBADO**, **52 EN_PROGRESO**, **263 PENDIENTE**, **1 FALLIDO**.
- No se declara aprobación general ni certificación canónica. Las pruebas faltantes incluyen 128 RPC de alto privilegio, importaciones históricas completas, validación del flujo de decretos de extremo a extremo, concurrencia, copias restauradas y la inspección de pantallas autenticadas.
- El conjunto de datos sacramentales real se conservó; todos los registros QA de esta etapa se revirtieron mediante ROLLBACK.

Informe de autoridad y fuentes: `AUDITORIA_CONCEPTOS_DEC_REGLAS_V98_2026-10-21.md`.
