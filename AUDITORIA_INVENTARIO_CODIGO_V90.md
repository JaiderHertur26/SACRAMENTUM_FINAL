# SACRAMENTUM V90 · Inventario estático y mapa de puntos de entrada

Esta es una exploración del código, NO una certificación de autorización del servidor. Una ruta puede ser pública deliberadamente.

Versión de referencia: V89 / 2ef4f3c

Total de módulos JS/JSX/MJS en src: 266
Páginas JSX activas y potencialmente inactivas: 73
Rutas JSX enumeradas: 109
Referencias de importación examinadas: 1550
Errores de parseo Babel: 0
Importaciones locales no resueltas: 0
Rutas sin envoltorio explícito de protección en su línea: 4
Rutas por rol de línea: {"ADMIN_GENERAL":4,"DIOCESE":6,"CHANCERY":13,"PARISH":31}
Operaciones de acceso a datos identificadas: {"RPC":79,"insert":18,"update":14,"delete":10,"upsert":1}

## Rutas sin protección explícita en la misma línea
 - / (línea 142)
 - /login (línea 143)
 - /account-configuration-error (línea 144)
 - /404 (línea 304)

## Importaciones que requieren revisión

## Errores de parseo

## Limitaciones
- El analizador infiere rutas a partir de líneas de App.jsx; puede omitir rutas construidas fuera del componente.
- Un RPC enumerado no se considera seguro por sí mismo; debe validarse en SQL con actor y jurisdicción.
- Que una ruta responda HTTP 200 no demuestra que permita leer o ejecutar su contenido con una sesión real.
- Los módulos sin ruta pueden ser componentes auxiliares válidos, no necesariamente código muerto.

Archivos de evidencia: AUDITORIA_INVENTARIO_CODIGO_V90.json y AUDITORIA_MAESTRA_CONTROLES_V90.json.
