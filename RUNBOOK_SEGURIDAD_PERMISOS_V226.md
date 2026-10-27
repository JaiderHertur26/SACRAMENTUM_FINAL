# SACRAMENTUM FINAL — V226 · SEGURIDAD DE LOS OBJETOS FUTUROS

## Pruebas actuales y futura base oficial
La base Supabase existente `foczofcmwampjvlfbsqn` contiene **solo datos ficticios de QA**. Se realizaron modificaciones únicamente a los **privilegios predeterminados de objetos futuros** creados por el rol `postgres`, sin eliminar ni cambiar registros, usuarios, partidas, notas, documentos ni permisos de tablas existentes. Cero datos oficiales.

## Remediación terminada
`supabase/security/qa-postgres-default-privileges-v226.sql`: operaciones repetibles `ALTER DEFAULT PRIVILEGES` que hacen que los futuros objetos `public` creados por `postgres` **no otorguen automáticamente permisos** a `anon`, `authenticated` o `service_role` sobre tablas, secuencias y funciones. Revoca también el EXECUTE global implícito para nuevas funciones del creador `postgres`. En nuevas migraciones, aplicar concesiones explícitas GRANT y políticas RLS en la misma versión del esquema.

Se ejecutó el ajuste en la base QA bajo el rol `postgres`. Una transacción temporal creó una tabla y función de ensayo y verificó que usuarios `anon` y `authenticated` **NO** pudieran consultarlas ni invocarlas. Se hizo `ROLLBACK` y se comprobó que los objetos temporales no persistían. Los 5.040 bautismos ficticios siguieron intactos.

## Riesgos todavía pendientes: supabase_admin
Este rol es un **creador distinto** y sus ACL no se modifican con las instrucciones de `postgres`. El actor SQL `postgres` consultado no posee membresía de `supabase_admin`, por lo que no es responsable intentar elevar privilegios o modificarlo a ciegas.

Se preparó `supabase/security/requires-authorized-supabase-admin-v226.sql` para ejecución por un operador autorizado en un ambiente controlado. El script valida su membresía y luego revoca concesiones predeterminadas futuras. **No ha sido ejecutado**, ni se enviará a CI como operación automática. Debe verificarse compatibilidad con el aprovisionamiento Supabase y su política de administración antes de ejecutarlo.

El nuevo preflight `scripts/release-security-preflight-v226.sql` descubre tanto permisos `IN SCHEMA public` como la ausencia de una revocación **global** de EXECUTE a `PUBLIC`. Los hallazgos de QA tras el ajuste son:
- 16 concesiones automáticas de tablas nuevas a `anon` / `authenticated` (propietario `supabase_admin`).
- 6 concesiones de secuencias y 2 concesiones de funciones (mismo propietario).
- 8 permisos peligrosos de tablas (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) y 2 de EXECUTE detectados en el preflight V224.
- 1 creador sin revocación global explícita del EXECUTE público (`supabase_admin`).
- 82/82 tablas RLS activas, 0 TRUNCATE actual para `anon` o `authenticated`, 0 FKs sin validar, 0 SECURITY DEFINER accesibles a `anon`.

**El lanzamiento oficial continúa bloqueado.** El guard V226 exige cero concesiones nuevas indebidas para todas estas clases, además de la certificación limpia y revisión manual de funciones.

## Inventario independiente de 152 RPC con privilegios
`AUDITORIA_RPC_INVENTARIO_LIVE_V226.json` cataloga 152 funciones `SECURITY DEFINER` ejecutables por `authenticated`, cada firma y su MD5 del código fuente SQL existente, sin copiar el código, nombres de sujetos o credenciales. 134 incluyen una referencia directa a `auth.uid()`; 83 contienen referencias a delegación conocida, con superposición entre ambos grupos; ninguna quedó sin *algún* indicador sintáctico de control, 101 contienen operaciones de escritura y ninguna carece de configuración de `search_path`.

Esto **no demuestra que las 152 funciones sean seguras**. El inventario es una lista de trabajo de auditoría para revisar jurisdicción, idempotencia, errores, autorización real, rutas de acceso y permisos. Ninguna está considerada revisada institucionalmente por el solo hecho de pasar esta detección de código.

## Puesta en marcha
1. **No tocar los datos QA**: no limpiar, borrar ni transferir datos de prueba.
2. Reproducir en un proyecto **nuevo e independiente** el esquema y los defaults restrictivos para cada creador autorizado; conceder solo los permisos expresamente requeridos a cada rol y activar RLS por defecto.
3. Ejecutar preflight V226 con lectura privilegiada, confrontar los 82 objetos públicos, todas las ACL futuras, RPC y Auth/Storage. Una tabla nueva o permiso inesperado **bloquea** la apertura.
4. Completar revisión institucional de 152 RPC, pruebas E2E con sesiones reales multirrol, cuatro sacramentos, Cancillería, impresión, correo y respaldos.
5. Autorizar la primera partida real solo con entorno vacío certificado y acta formal; nunca convertir ni copiar registros de QA.

## CI y compilación
Se modernizaron las acciones GitHub a `actions/checkout@v5` y `actions/setup-node@v5` con Node 24 en el runner y Node 22 para el proyecto (`.nvmrc`). 17 casos V226 específicos fueron agregados al gate local y CI.

**Advertencia:** la carpeta `supabase/security/` contiene scripts administrativos de ejecución controlada, no instrucciones automáticas de limpieza ni migraciones ya ejecutadas.
