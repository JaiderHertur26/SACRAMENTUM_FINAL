# SACRAMENTUM · ESTADO FINAL CONSOLIDADO

Estado operativo: **V27 ESTABLE**  
Fecha de corte: **25 de septiembre de 2026**

## Validación de frontend
- Vite: **8.3.1**
- React Router DOM: **7.18.4**
- Plugin React Vite: **6.1.1**
- Módulos transformados: **3076**
- CSS: **108.50 kB** (**18.21 kB gzip**)
- Bundle inicial JS: **403.68 kB** (**126.39 kB gzip**)
- Build medido después de saneamiento de dependencias: **4.50 s**
- Build medido después de code splitting: **7.47 s**
- Exit code: **0**
- Aviso de chunks >500 kB: **eliminado**

Antes del code splitting el bundle principal era 1,963.61 kB (491.94 kB gzip).
La carga inicial se redujo aproximadamente **79% en tamaño bruto** y **74% en gzip**.

## Dependencias
- `npm audit`: **0 vulnerabilidades**
- No se utilizó `npm audit fix --force`.
- Vite actualizado de 4.x a 8.3.1.
- React Router DOM actualizado a 7.18.4.
- Browserslist y dependencias transitivas vulnerables actualizadas mediante `npm audit fix` normal.
- Compatibilidad futura de Vite corregida: `import.meta.dirname` y extensión explícita de `visual-editor-config.js`.

## Arquitectura de carga
`src/App.jsx` usa `React.lazy()` + `Suspense` para páginas y módulos.

Resultado:
- la portada ya no descarga todos los módulos parroquiales, diocesanos y de Cancillería;
- Bautismo, Confirmación, Matrimonio, Exequias, Centro de Migración, reportes y decretos se descargan bajo demanda;
- se conserva el mismo enrutado, RLS y autorización por rol.

## Regresión funcional
Todos los gates ejecutados después de V27 terminaron con exit code 0:
- Párroco actual V19: **12/12**
- Bautismo: **OK**
- Confirmación: **OK**
- Importación legacy relacional: **OK**
- Exequias ↔ Bautismo V7: **14/14**
- Notificaciones V15: **OK**
- Notificación Matrimonial V16C: **29/29**
- Notas históricas matrimoniales V17: **25/25**
- Visibilidad auxiliar V18: **17/17**
- Separación de nombres legacy V20: **14/14**

## Backend / Supabase
Proyecto canónico: **REGISTRO SACRAMENTOS**  
Project ref: `foczofcmwampjvlfbsqn`

Historial:
- 30 migraciones registradas.
- `supabase migration list`: **Local = Remote**.
- Última migración aplicada: `20260925162224_privileged_rpc_hardening_v25.sql`.

## Seguridad V22–V25
### V22 · Security Hardening
- `anon`: **0 privilegios sobre tablas** del esquema `public`.
- `official_notifications`: lectura RLS por ámbito institucional; mutaciones por RPC.
- objetos internos/legacy sin acceso directo innecesario.
- funciones auxiliares señaladas por el linter con `search_path` fijo.

### V23 · Function Execution Hardening
- `anon`: **0 funciones ejecutables**.
- rol universal `PUBLIC`: **0 funciones públicas ejecutables**.
- `authenticated` y `service_role` conservan grants explícitos necesarios.

### V24 · RLS & Performance
- tablas con múltiples políticas SELECT redundantes: **0**.
- políticas reorganizadas por INSERT/UPDATE/DELETE.
- optimización de evaluaciones `auth.uid()`.
- índices añadidos a FKs activas de sacramentos, notificaciones, chat y jerarquía.

### V25 · Privileged RPC Hardening
- FKs sin índice: **0**.
- triggers ejecutables directamente por `authenticated`: **0**.
- helpers `_internal` ejecutables directamente por `authenticated`: **0**.
- funciones de mantenimiento/diagnóstico retiradas de la API cliente.
- `sacramentum_recalculate_current_priest(uuid)` exige sesión y jurisdicción.
- auditoría automática de RPC `SECURITY DEFINER` restantes: **0 sin guarda directa o delegada detectada**.

## Avisos de Supabase que requieren criterio
Que una tabla aparezca en GraphQL para `authenticated` no implica acceso irrestricto: SACRAMENTUM usa RLS y acceso directo a tablas autenticadas.

Los RPC `SECURITY DEFINER` que permanecen expuestos son flujos funcionales y fueron revisados para contar con guardas directas o delegadas.

### Protección de contraseñas filtradas
Supabase Advisor informa que *Leaked Password Protection* está desactivada.
La documentación oficial indica que esta función está disponible en **Supabase Pro o superior**. La organización actual está en **Free**, por lo que no se activó ni se simuló su activación.

## Checkpoints
- Pre-V22 seguridad: `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V22_SECURITY`
- Pre-V26 dependencias: `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V26_DEPENDENCIES`
- Pre-V27 code splitting: `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V27_CODE_SPLITTING`

## Inicio local
```bat
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
npm run dev
```

## Build
```bat
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
npm run build
```

## Auditoría de dependencias
```bat
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
npm audit
```

Resultado esperado del corte V27: **found 0 vulnerabilities**.
