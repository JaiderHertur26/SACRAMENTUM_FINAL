# SACRAMENTUM · V94: auditoría de integridad de parámetros y libros sacramentales

**Fecha:** 21/10/2026. **Hallazgo:** V94-SEC-003. **Severidad:** ALTA en integridad de configuración registral.

## Evidencia de autorización incorrecta

Las políticas RLS de `public.parish_parameters` y `public.sacrament_books` tenían la excepción `is_app_admin()` para INSERT, UPDATE y DELETE. Esa excepción permitía al Administrador General operar directamente en configuraciones y numeraciones de parroquias, fuera de su competencia institucional establecida.

**Reproducción anterior al parche:** sesión SQL `authenticated`, perfil de Administrador General, `UPDATE public.parish_parameters SET parish_id=parish_id` sobre una parroquia; resultado **1 fila afectada**. Se hizo una asignación sin cambio de valor y se ejecutó `ROLLBACK`.

La amenaza no era únicamente visual: la política se aplicaba al acceso directo desde la API de datos y permitía alterar datos o suprimir libros sin pasar por las operaciones legitimadas de Parroquia.

## Corrección aplicada

Migración `guard_parish_parameters_and_books_v94`, en
`supabase/migrations/20261021180904_guard_parish_parameters_and_books_v94.sql`.

Seis políticas se actualizaron mediante `ALTER POLICY`, conservando las tablas y todos sus registros. En INSERT, UPDATE y DELETE se exige:

```sql
public.current_app_role() = 'parish'
AND parish_id = public.current_app_parish_id()
```

En UPDATE se exige tanto `USING` como `WITH CHECK`, evitando trasladar un libro o una configuración a otra parroquia durante la actualización. Las rutas legítimas de Parroquia quedan operativas.

## Matriz conductual real tras la corrección

Todas las pruebas se hicieron con sesiones SQL simuladas para perfiles institucionales reales y transacciones con `ROLLBACK`.

| Rol | UPDATE parámetros (filas) | UPDATE libro ficticio | DELETE libro ficticio |
|---|---:|---:|---:|
| Administrador General | 0 | 0 | 0 |
| Diócesis | 0 | 0 | 0 |
| Cancillería | 0 | 0 | 0 |
| Parroquia propietaria | 1 | 1 | 1 |

- Se comprobó además que INSERT directo en parámetros y libros por Administrador General recibe **42501 insufficient_privilege** en ambos casos.
- **12/12 comprobaciones** de UPDATE/DELETE y cuatro roles, más dos pruebas negativas de INSERT como Administrador General.
- Los libros ficticios se registraron exclusivamente dentro del mismo bloque de transacción, sin persistencia.

Postcondiciones verificadas: `sacrament_books=0` y `parish_parameters=3` en la base; también cero boletas QA de la V93.

## Regresión automatizada

`scripts/test-parish-book-ownership-v94.mjs` contiene 8 pruebas estáticas para las políticas y preservación de datos.

Se incorpora a la puerta `scripts/audit-gate-v90.mjs` y a GitHub Actions. El conjunto actualizado contiene **227 pruebas sintéticas** (206 + 5 + 8 + 8), más los verificadores históricos, compilación y control de CSS.

## Alcance y pendientes explícitos

La corrección NO cubre otras excepciones de Administrador General en tablas auxiliares como `ciudades`, `iglesias`, `diocesis`, `obispos`, `parrocos` y `mis_datos`. Se han identificado y requieren evaluación detallada de competencias y operaciones legítimas, antes de retirar permisos en bloque.

Las cinco advertencias HIGH de dependencias continúan pendientes, por lo que la puerta integral de seguridad sigue sin aprobación. Tampoco se certifican aquí todas las 128 RPC restantes.
