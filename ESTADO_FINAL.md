# SACRAMENTUM · ESTADO FINAL CONSOLIDADO

Estado operativo: **V29 ESTABLE · RESOLUCIÓN INTELIGENTE DE CÓDIGOS LEGACY**
Fecha de corte: **25 de septiembre de 2026**

## Validación de frontend
- Vite: **8.3.1**
- React Router DOM: **7.18.4**
- Plugin React Vite: **6.1.1**
- Módulos transformados: **3078**
- CSS: **108.50 kB** (**18.21 kB gzip**)
- Bundle inicial JS: **403.71 kB** (**126.39 kB gzip**)
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

---
## V28 · SISTEMA DOCUMENTAL ECLESIAL · 2026-09-25

Objetivo: elevar todas las boletas/constancias y partidas existentes al nivel visual de Matrimonio, con una identidad más eclesial, sobria y uniforme.

### Familia visual maestra
- Azul eclesial profundo + oro envejecido + blanco/marfil.
- Cruz institucional común.
- Doble borde sobrio.
- Títulos en serif y datos en sans/monoespaciada según función.
- Cabecera institucional unificada.
- Libro/Folio/Número como referencia canónica visible en partidas.
- Firma y sello parroquial con jerarquía uniforme.
- Pie documental SACRAMENTUM.

### Boletas / documentos previos
- `BaptismTicket.jsx`: rediseño completo.
- `ConfirmationTicket.jsx`: rediseño completo.
- `MatrimonioTicket.jsx`: armonizado con la familia maestra.
- Cada documento mantiene copia para archivo y copia familiar/contrayentes.
- Se declara visualmente que la boleta/constancia NO constituye ni sustituye una Partida.
- Se evita mostrar Libro/Folio/Número como si ya existieran antes del asiento.

### Partidas
- `BaptismPrintTemplate.jsx`: nueva certificación eclesiástica.
- `ConfirmationPrintTemplate.jsx`: nueva certificación eclesiástica.
- `MatrimonioPrintTemplate.jsx`: armonizado y elevado.
- `FuneralPartidasPage.jsx`: usa generador eclesial común para Partida y Constancia.
- `funeralDocumentHtml.js`: nuevo motor de impresión de Exequias.
- Notas marginales, estados no vigentes y firmas conservan su semántica.

### Integridad documental
- Partidas históricas NO infieren lugar de celebración desde la parroquia actual.
- Si el dato histórico no consta, el documento muestra vacío/guion; no inventa información.
- Lógica sacramental, consecutivos, asientos, notas, RLS y RPC no fueron modificados.

### Arquitectura
- Nuevo componente compartido: `src/components/sacramental/EcclesialDocumentPrimitives.jsx`.
- Gate nuevo: `scripts/verify-ecclesial-documents-v28.mjs`.
- Resultado gate: **29/29**.

### Validación final
- `npm audit`: 0 vulnerabilidades.
- Bautismo: OK.
- Confirmación: OK.
- V7 Exequias ↔ Bautismo: 14/14.
- V15: OK.
- V16C: 29/29.
- V17: 25/25.
- V18: 17/17.
- V19: 12/12.
- V20: 14/14.
- Build Vite 8.3.1: **3078 módulos, 10.59 s, exit code 0**.

Checkpoint previo: `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V28_DOCUMENTOS`.

ESTADO CANÓNICO ACTUAL: **V28 ESTABLE · SISTEMA DOCUMENTAL ECLESIAL**.

---
## V29 · RESOLUCIÓN INTELIGENTE DE CÓDIGOS LEGACY · 2026-09-25

Objetivo: impedir que los registros históricos muestren códigos técnicos cuando existe una equivalencia humana verificable en los catálogos parroquiales.

### Reglas históricas verificadas
- Sexo: `1 = MASCULINO`, `2 = FEMENINO`.
- Tipo de unión: `1 = MATRIMONIO CATÓLICO`, `2 = MATRIMONIO CIVIL`, `3 = UNIÓN LIBRE`, `4 = MADRE SOLTERA`, `5 = OTRO CASO`.
- Código de sacerdote / DA FE / Ministro: se resuelve exclusivamente contra Párrocos de la misma parroquia y sólo con coincidencia única.
- Si el código no tiene equivalencia, se conserva como `CÓDIGO LEGADO XXXX · NOMBRE NO CONSTA`; nunca se inventa un nombre.

### Alcance
- Bautismo: partidas, boletas, lectura histórica y nuevas importaciones.
- Confirmación: partidas, boletas, lectura histórica y nuevas importaciones.
- Matrimonio: expedientes/boletas, partidas, `legacy_normalized` y futuros legados.
- Exequias: pendientes, partidas y futuros legados.

### Persistencia y trazabilidad
- El JSON original se conserva.
- Se agrega `legacy_resolved` para valores humanizados sin destruir la evidencia de origen.
- Los triggers V29 normalizan escrituras nuevas y actualizaciones.
- Cambios en Datos Auxiliares → Párrocos refrescan automáticamente referencias históricas de esa parroquia.

### Backfill real
- Bautismos con DA FE numérico antes de V29: 46.
- DA FE numérico después de V29: 0.
- Resueltos por catálogo: 7 (`0001`: 1; `0004`: 6).
- Sin equivalencia actual: 39 (`0005`: 2; `0006`: 37).
- Los 46 Bautismos históricos tienen sexo y unión humanizados en `legacy_resolved`.
- Las 173 Confirmaciones históricas tienen sexo humanizado en `legacy_resolved`.

### Frontend
- Nuevo `src/utils/legacyDisplayResolvers.js`.
- El nombre canónico/resuelto de Supabase tiene prioridad sobre caché local.
- El catálogo local sólo actúa como fallback para resolver códigos.
- Código ambiguo no se resuelve.

### Base de datos
- `20260925183731_legacy_reference_resolution_v29.sql`.
- `20260925183931_legacy_reference_resolution_v29_hardening.sql`.
- `20260925184038_legacy_reference_resolution_v29_lockdown.sql`.
- `20260925184206_legacy_reference_resolution_v29_final_hardening.sql`.
- Historia local y remota de migraciones alineada.

### Validación
- Gate V29: 38/38.
- Gate documental V28: 29/29.
- V19: 12/12.
- Bautismo: OK.
- Confirmación: OK.
- Exequias ↔ Bautismo V7: 14/14.
- V15: OK.
- V16C: 29/29.
- V17: 25/25.
- V18: 17/17.
- V20: 14/14.
- npm audit: 0 vulnerabilidades.

Checkpoint previo: `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V29_LEGACY_RESOLUTION`.

ESTADO CANÓNICO ACTUAL: **V29 ESTABLE · RESOLUCIÓN INTELIGENTE DE CÓDIGOS LEGACY**.

