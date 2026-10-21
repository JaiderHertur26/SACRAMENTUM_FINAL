# SACRAMENTUM · Auditoría de dependencias V90

Fecha: 2026-10-21. Comando ejecutado en el proyecto canónico:

```powershell
npm audit --omit=dev --json
```

**Resultado: 8 avisos, 6 de severidad alta, 2 moderada, 0 crítica.**

Paquetes señalados por npm: braces (alta), chokidar (alta), fast-glob (alta), micromatch (alta), postcss-nested (moderada), postcss-selector-parser (moderada), source-map-js (alta), tailwindcss (alta).

- npm indica que algunas correcciones automáticas de la cadena Tailwind necesitarían un salto mayor a Tailwind 4.3.3. **No se ejecutó ese cambio sin validar compatibilidad con el diseño**.
- El reporte es sobre dependencias del proyecto/build, no una explotación demostrada del sitio de producción. La severidad debe contrastarse con el alcance real de cada paquete.
- La prueba de compilación de V89 estaba aprobada, pero no constituye una prueba de seguridad de dependencias.
- Se registrará como hallazgo abierto para remediación por escenario controlado, nueva compilación, comparación de pantallas y regresión integral.

Evidencia íntegra local (salida JSON de npm audit): scripts/AUDITORIA_DEPENDENCIAS_V90.json.

Próximas pruebas: separar dependencias expuestas al navegador de herramientas de desarrollo, calcular árbol de dependencia con npm explain, preparar una rama de prueba de actualización sin modificar la producción, repetir pruebas y solo entonces aplicar.
