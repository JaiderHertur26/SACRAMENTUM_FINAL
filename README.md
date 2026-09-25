# SACRAMENTUM

**Sistema Eclesial de Registro Sacramental**

Entrega final consolidada del frontend SACRAMENTUM, con integración Supabase, estructura eclesiástica, gestión sacramental, Cancillería, decretos, reportes, chat y migración histórica.

## Puesta en marcha en Windows

Requiere Node.js según `.nvmrc`.

La forma más simple es ejecutar:

```bat
INICIAR_SACRAMENTUM.cmd
```

El script instala dependencias con `npm ci` si todavía no existen y luego inicia Vite.

También puede hacerse manualmente:

```bat
npm ci
npm run dev
```

## Variables de entorno

La aplicación usa:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Esta entrega incluye el `.env.local` del proyecto recibido, compuesto únicamente por variables públicas de frontend. Nunca agregue una `SUPABASE_SERVICE_ROLE_KEY` ni otro secreto privilegiado a una variable `VITE_*`.

## Build de producción

```bat
COMPILAR_SACRAMENTUM.cmd
```

o manualmente:

```bat
npm ci
npm run build
```

El directorio `dist/` incluido corresponde al build validado 034O1.

## Fuente de verdad

- Supabase Auth: autenticación y sesión.
- `user_profiles`: rol y jurisdicción.
- PostgreSQL/Supabase: datos institucionales y sacramentales.
- `localStorage`: caché/preferencias/compatibilidad, nunca autoridad institucional.

Roles canónicos:

- `admin_general`
- `diocese`
- `chancery`
- `parish`

## Backend Supabase

La carpeta `supabase/` contiene:

- migraciones base 001–025;
- funciones Edge disponibles;
- preflight/postflight y documentación de seguridad;
- `applied-history/` con SQL posteriores recuperados como respaldo de fases ya aplicadas.

**No reejecute migraciones o SQL de `applied-history/` en el proyecto productivo.** El proyecto Supabase canónico ya contiene esas fases y la fuente de verdad es el esquema remoto vigente.

## Entrega final

No hay instaladores `APLICAR_034...`, payloads de hotfix ni ZIPs internos. Esta copia reemplaza la cadena de parches y debe tratarse como la nueva base completa del proyecto.

Consulte `ESTADO_FINAL.md` para el cierre técnico de la entrega.
