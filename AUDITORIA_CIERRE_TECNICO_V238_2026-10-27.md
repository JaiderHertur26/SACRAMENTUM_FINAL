# SACRAMENTUM FINAL V238 — Matriz real de aislamiento institucional

**Fecha:** 27 de octubre de 2026. **Proyecto:** Supabase QA `foczofcmwampjvlfbsqn`. Todas las cuentas y registros son ficticios; esta prueba **NO habilita uso oficial**.

## Hallazgo y método
Las pruebas previas de identidad tenían verificaciones de fuente de funciones y ejemplos sintéticos, pero faltaba un ensayo explícito de jurisdicción con el rol PostgreSQL real de `authenticated`. Se ejecutaron **transacciones de solo lectura** y con `ROLLBACK`, definiendo de forma local `request.jwt.claim.sub` exclusivamente con identificadores internos de las 12 cuentas QA. No se publicaron esos identificadores ni se extrajo contenido de partidas. No se realizó ninguna escritura.

Para cada cuenta se ejecutó como rol `authenticated` la lectura de los resultados de `can_access_diocese` para las tres diócesis, de `can_access_parish` para las seis parroquias, `is_app_admin` y `can_manage_legacy_import(NULL,NULL)`. Los 132 resultados se compararon con la matriz de permisos esperada (Parroquia restringida a su parroquia, Cancillería/Diócesis restringidas a su diócesis, Administrador General con acceso global; importación sin ámbito exclusiva del rol diocesano según la regla instalada): **132/132 conformes**.

Luego se probó el aislamiento **efectivo de filas** de las tablas `baptisms`, `confirmations`, `marriages` y `funerals`, todas con RLS `can_access_parish(parish_id)`. Para las mismas 12 identidades se consultó únicamente `COUNT(*)` bajo el rol `authenticated` y se comparó con los conteos esperados previamente agrupados mediante acceso privilegiado por parroquia/diócesis. Resultado: **48/48 conformes**.

Se comprobó por separado que, sin JWT, el rol autenticado no obtiene identidad, rol, acceso a parroquias ni condición de administrador.

**Total: 180 observaciones directas, 180 correctas, 0 discrepancias.** La evidencia técnica mínima se guarda en `AUDITORIA_MATRIZ_ROLES_LIVE_V238.json`.

## Reproducción técnica sin exponer datos
Se usó en cada actor ficticio una transacción equivalente a:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '<QA_AUTH_USER_UUID>', true);
SELECT public.current_app_role(), public.is_app_admin(),
       public.can_access_parish('<PARISH_UUID>'::uuid),
       public.can_access_diocese('<DIOCESE_UUID>'::uuid);
SELECT COUNT(*) FROM public.baptisms;
ROLLBACK;
```

Los valores concretos se seleccionaron de las 12 cuentas activas y seis parroquias de QA; las consultas se ejecutaron efectivamente y se compararon contra la relación de pertenencia observada. Los marcadores de esta plantilla se sustituyen **solo en QA**, y nunca se confía en una cadena enviada por un cliente como sustituto de un JWT validado por Supabase.

## Controles y límites
- `scripts/test-live-role-perimeter-evidence-v238.mjs` comprueba la consistencia aritmética, cobertura y límites del informe histórico. Se añadió a auditoría local y CI.
- **Importante:** esos tests de CI son **offline** y verifican el documento de evidencia fechado; **no vuelven a conectar automáticamente Supabase ni repiten las 180 consultas**. La prueba real ya se efectuó durante la presente auditoría y no se debe presentar como seguimiento continuo.
- No se inspeccionaron datos de personas, partidas ni mensajes; solo pertenencia institucional, conteos y respuestas booleanas.
- Permanecen 152 funciones RPC accesibles con `SECURITY DEFINER` sin aprobación semántica institucional final y quedan por verificar **permisos de escritura y flujos completos** firma por firma.
- No se creó base limpia oficial, no se ensayó backup restaurado, ni se certificaron SMTP, recuperación de cuenta o documentos impresos.

**Avance técnico ponderado mantenido: 97,41 %.** Sin un proyecto nuevo vacío e independiente y sus pruebas operacionales, SACRAMENTUM debe seguir sin autorización de registro sacramental oficial.
