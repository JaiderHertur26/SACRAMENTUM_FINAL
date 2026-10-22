# SACRAMENTUM V107 · Acta de cierre técnico y publicación

**Fecha:** 21 de octubre de 2026 (Colombia). **Commit de implementación:** `dfd42da`. **Rama:** `main` sincronizada con `origin/main`.

## Publicación

- Vercel en estado **Ready**: https://sacramentum-final-exvab6v6q-jaiderherreras-projects.vercel.app
- Alias productivo: https://sacramentum-final.vercel.app
- HTTP 200 verificado: `/`, `/chancery/decretos/archivo?type=tribunal&sacrament=matrimonio`, `/diocese/decretos/archivo`, `/parroquia/decretos/archivo?type=tribunal&sacrament=matrimonio`.
- CSS productivo `/assets/index-CXVrymZ9.css`, **111.679 bytes**, SHA-256 `DEF0362E10E9720044FD269AFC6389A3ED5A2A0B462785FD4520A764EE795C14`. Aumentó respecto a V106 porque V107 añade clases/controles. **No se ha completado una evaluación visual autenticada de todas las pantallas**.

## Base de datos y límites jurídicos

Migración `nullity_judicial_review_intake_v107` aplicada en Supabase. Permite a Cancillería abrir un expediente documental de revisión vinculado a sentencia activa. Se mantiene inalterada la sentencia original y la nulidad registrada, sin eliminar Bautismos, notas o acuses.

- Autorizar solicitud: Cancillería (misma diócesis) solamente.
- Ver solicitud: Cancillería, Diócesis y Parroquia propietaria en lectura jurisdiccional RLS.
- Administrador General: no puede crear ni leer expediente. Usuario anónimo: sin lectura ni ejecución.
- Sin permisos DML directos `authenticated`; escritura por RPC validada.
- Referencias documentales obligatorias, motivo sustantivo, instantánea de efectos y auditoría. Un único expediente abierto por sentencia.
- **No existe todavía acto de revocación jurídica automatizado**. Se requiere resolución formal de autoridad judicial competente, diseño de anotación correctiva y comunicación nueva, sin borrar el historial original.

## Pruebas de base reales, todas transaccionales y ficticias

1. Matrimonio y nulidad ficticios insertados en BEGIN, Cancillería registró solicitud, original conservó estado.
2. Solicitudes por Admin General, Diócesis y Parroquia rechazadas.
3. Segundo expediente abierto para la misma sentencia rechazado.
4. Solicitud con referencias/motivo incompletos rechazada.
5. RLS probada con cuatro usuarios: Admin General vio 0 casos, Diócesis 1, Cancillería 1, Parroquia propietaria 1.
6. Confirmados 0 expedientes, decretos, matrimonios y eventos de revisión ficticios después de `ROLLBACK`.

## Regresión y puertas

- **361/361 pruebas sintéticas**, con **22 nuevos casos V107**.
- **23 verificadores históricos** correctos y build Vite sin errores.
- Gate local: **25/26** controles técnicos de ejecución; `dependencias-externas` en FAIL por 5 HIGH.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39705413686
  - `pruebas-funcionales: SUCCESS`
  - `seguridad-dependencias: FAILURE` (cinco HIGH).

## Plan maestro de 325 controles (distinto a las 361 pruebas)

**9 APROBADO, 70 EN_PROGRESO, 245 PENDIENTE, 1 FALLIDO**.

## Asesor de seguridad Supabase

- `authenticated_security_definer_function_executable`: 126 avisos WARN.
- `pg_graphql_authenticated_table_exposed`: 61 avisos WARN (se incrementó uno por la nueva tabla visible bajo SELECT scoped/RLS; no implica lectura de datos ajenos).
- `auth_leaked_password_protection`: 1 aviso WARN.

Guías oficiales:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Pendientes de alta prioridad

Validación visual con sesiones de los tres roles; procedimiento jurídico de decisión posterior y comunicaciones entre parroquias ante una sentencia modificativa; revisión de 126 funciones privilegiadas, integridad de operaciones concurrentes, recuperación de backup en sandbox y remediación de cinco HIGH. La aplicación no está certificada integralmente.
