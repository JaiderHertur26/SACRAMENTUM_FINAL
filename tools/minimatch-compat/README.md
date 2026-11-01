# Compatibilidad de minimatch

El motor es el paquete oficial `minimatch@11.0.1`, instalado con el alias `@sacramentum/minimatch-engine`, versión exacta e integridad en package-lock.json. El adaptador no contiene un algoritmo de reconocimiento propio ni conserva código de versiones anteriores.

Los plugins CommonJS de ESLint esperan que `require('minimatch')` sea una función. El adaptador conserva esa forma y las propiedades del motor; para ESM reexporta la API oficial. La actualización a ESLint 9 elimina la antigua cadena glob/rimraf que dependía de detalles internos del matcher anterior.

El servicio de producción no importa este módulo. Se valida la resolución desde cada consumidor, el motor instalado, patrones de rutas y la detección efectiva de variables y hooks inválidos mediante la configuración real de ESLint. La auditoría estándar de npm continúa exigiendo cero vulnerabilidades; no se añadieron exclusiones.

Referencias: https://github.com/advisories/GHSA-g3hv-75wg-m249 · https://github.com/isaacs/minimatch · https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides
