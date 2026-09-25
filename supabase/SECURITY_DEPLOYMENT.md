# Sacramentum · despliegue de seguridad Supabase

## Estado
El frontend ya utiliza una sola sesión (`Supabase Auth`) y rechaza perfiles sin jurisdicción. Los scripts de `security/` son una revisión controlada y **no se aplican automáticamente** al proyecto remoto. Se mantienen fuera de `migrations/` para impedir un `db push` accidental antes de validar el esquema real.

## Orden recomendado
1. Crear un proyecto de *staging* o respaldo de la base actual.
2. Revisar y ejecutar manualmente `security/001_security_helpers_review.sql`.
3. Probar las funciones con usuarios `admin_general`, `diocese`, `chancery` y `parish`.
4. Revisar que las tablas del archivo `security/002_rls_core_review.sql` y sus columnas coincidan con producción.
5. Desplegar la Edge Function `activate-environment` antes de cerrar el acceso público a `pending_tokens`.
6. Aplicar RLS de forma progresiva, tabla por tabla, verificando lectura, creación, corrección, reposición e impresión.

## Regla de arquitectura
- `auth.users`: credenciales.
- `user_profiles`: rol y jurisdicción.
- Supabase/PostgreSQL: fuente oficial de datos.
- IndexedDB: caché/offline.
- `localStorage`: preferencias y caché no sensible, nunca contraseñas.

## Pruebas mínimas antes de producción
- Una parroquia no puede leer ni modificar sacramentos de otra parroquia.
- Cancillería puede actuar solo dentro de su diócesis.
- Diócesis no puede administrar otra diócesis.
- Admin general conserva acceso global autorizado.
- Un perfil sin `parish_id`/`diocese_id` válido queda bloqueado.
- Un token de activación solo puede consumirse una vez.

## Activación segura de entornos
La función `functions/activate-environment/index.ts` mueve la creación de identidad y perfil fuera del navegador y usa `SUPABASE_SERVICE_ROLE_KEY` únicamente en el servidor.

Despliegue orientativo con Supabase CLI:
```bash
supabase functions deploy activate-environment --no-verify-jwt
supabase secrets set ALLOWED_ORIGIN=https://tu-dominio.com
```
El frontend de Fase 2 invoca siempre esta Edge Function para activar entornos. No existe fallback de activación en el navegador. Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` en Vite ni en variables `VITE_*`.
