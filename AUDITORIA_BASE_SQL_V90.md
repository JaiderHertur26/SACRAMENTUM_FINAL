# SACRAMENTUM · Auditoría del esquema SQL V90

Fecha: 2026-10-21. Proyecto Supabase: REGISTRO SACRAMENTOS (referencia foczofcmwampjvlfbsqn).

## Evidencia de catálogo, consultas de solo lectura

- Tablas físicas en esquema public: **73**.
- Tablas con Row Level Security habilitada: **73**.
- Tablas físicas sin RLS: **0**.
- Vistas públicas: **0**.
- Políticas RLS en public: **124**.
- Llaves foráneas en public: **138**.
- Restricciones de clave primaria o unicidad: **95**.
- Triggers definidos por la aplicación: **49**.
- Funciones SQL públicas: **211**.
- Funciones SQL con SECURITY DEFINER: **180**.
- Funciones SECURITY DEFINER ejecutables por authenticated: **129**.
- Funciones SECURITY DEFINER ejecutables por anon: **0**.

## Cribado de RPC por control de identidad

La búsqueda estática dentro del cuerpo de las 129 funciones privilegiadas identificó **seis** que no incluyen en su propio texto los patrones básicos de rol/identidad usados en otras funciones:

1. count_unread_chat_messages()
2. get_chat_room_messages(uuid,integer,timestamptz)
3. mark_chat_room_read(uuid)
4. register_historical_baptism(uuid,jsonb)
5. send_chat_message(uuid,text,uuid)
6. withdraw_chat_message(uuid)

**Esto no equivale a seis vulnerabilidades.** La inspección encontró guardias delegadas por can_access_chat_room / current_chat_profile_id para las funciones de chat y por register_historical_baptism_internal para la digitalización histórica. Falta probar esos caminos con sesiones de miembros y no miembros; se mantienen en progreso.

La existencia de 124 políticas y RLS en 73 tablas no demuestra que las políticas sean correctas. Debe ejecutarse una matriz de lectura/escritura con usuarios pertenecientes a dos parroquias y dos diócesis, incluyendo casos de cambio de jurisdicción y anulaciones.

## Alertas actuales del asesor Supabase

- 60 objetos public que aparecen en el esquema GraphQL para authenticated: advertencia de descubrimiento, no evidencia de lectura no autorizada si sus políticas RLS son efectivas.
- 129 RPC SECURITY DEFINER ejecutables por authenticated: investigar los límites específicos de cada una.
- Protección de contraseñas filtradas: el asesor informa que no está activada; requiere revisión de configuración de Auth para determinar el cambio aplicable.

No se han deshabilitado esas 129 funciones ni retirado SELECT de 60 tablas de forma masiva: hacerlo rompería la aplicación sin demostrar mejora de permisos. Se revisarán caso a caso.

## Controles SQL para repetir sin alterar datos

```sql
select count(*) filter(where c.relrowsecurity) rls_on,
       count(*) filter(where not c.relrowsecurity) rls_off
from pg_class c join pg_namespace n on c.relnamespace=n.oid
where n.nspname='public' and c.relkind in ('r','p');

select count(*) as rpcs_privilegiadas
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.prosecdef and has_function_privilege('authenticated',p.oid,'EXECUTE');

select count(*) as rpcs_privilegiadas_anon
from pg_proc p
where p.pronamespace='public'::regnamespace
  and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE');
```

## Método para dar un control por aprobado

Los conteos del catálogo prueban inventario y activación de RLS, pero no la autorización correcta. Una RPC sólo queda aprobada cuando pasa pruebas positivas, negativas y entre ámbitos territoriales, con test transaccional o sandbox, evidencia y comparación de datos antes/después.
