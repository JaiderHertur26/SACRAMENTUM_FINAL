# SACRAMENTUM · Fase 4 Territorial

Objetivo: consolidar la jerarquía **Diócesis/Arquidiócesis → Vicaría → Decanato → Parroquia**, cerrar rutas legacy de edición territorial y endurecer los códigos de activación.

## Orden de actualización

1. Ejecutar `preflight/20260905_phase4_territorial_preflight.sql` en el proyecto correcto de Supabase.
2. Si no hay columnas `MISSING`, duplicidad de Cancillería ni cruces territoriales que deban corregirse, aplicar `migrations/20260905_025_territorial_integrity_and_activation_hardening.sql`.
3. Desplegar únicamente `functions/activate-environment/index.ts` manteniendo la función pública (`--no-verify-jwt`).
4. Ejecutar `preflight/20260905_phase4_territorial_postflight.sql`.
5. Actualizar los archivos de frontend incluidos en el paquete de aplicación y ejecutar `npm run build`.
6. Prueba funcional mínima:
   - crear Vicaría;
   - crear Decanato dentro de esa Vicaría;
   - emitir autorización de Parroquia seleccionando obligatoriamente Vicaría y Decanato;
   - activar el código con nombre completo, email y contraseña;
   - confirmar `parishes`, `auth.users`, `user_profiles` y consumo del token;
   - comprobar que la Parroquia aparece dentro del Decanato correcto.

## Reglas consolidadas

- Administrador General: autoriza y administra Diócesis/Arquidiócesis; no crea ni modifica su estructura territorial interna.
- Diócesis/Arquidiócesis: crea y administra Vicarías y Decanatos, y autoriza Parroquias y su única Cancillería.
- La fila de una nueva Parroquia o Cancillería nace al consumir su código en `activate-environment`; no existe `INSERT` directo desde el navegador para esas dos entidades.
- Toda nueva Parroquia debe pertenecer a una Vicaría y a un Decanato.
- Un Decanato no puede cruzar jurisdicciones.
- Una Parroquia no puede apuntar a Vicaría/Decanato de otra jurisdicción.
- Una Cancillería por jurisdicción.
- Una Parroquia o Cancillería con identidad institucional vinculada no se elimina físicamente desde la estructura territorial.
- Los códigos `PARISH` y `CHANCERY` sólo pueden ser emitidos por un usuario diocesano activo y para su propia jurisdicción.

## Edge Function

La versión de `activate-environment` valida que:

- el emisor del código siga activo y tenga el rol autorizado;
- `DIOCESE` provenga del Administrador General;
- `PARISH` y `CHANCERY` provengan de la Diócesis/Arquidiócesis propietaria;
- una Parroquia tenga Vicaría y Decanato válidos de la misma jurisdicción;
- la Cancillería no esté duplicada;
- el responsable proporcione `full_name`, email y contraseña válida.

La función conserva el rollback compensatorio y restaura el token si la activación no concluye por completo.
