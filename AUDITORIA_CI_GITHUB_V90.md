# SACRAMENTUM · GitHub Actions — evidencia V90

Fecha: 21 de octubre de 2026. Repositorio: JaiderHertur26/SACRAMENTUM_FINAL.

Se incorporó .github/workflows/sacramentum-auditoria-v90.yml, con dos trabajos independientes: pruebas funcionales y auditoría de dependencias, ejecutados automáticamente por cada push/PR en main.

## Primer resultado: se detectó defecto de portabilidad

Commit: 8233589. Ejecución: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39633126156

- Pruebas sintéticas: correctas.
- Verificadores históricos: **fallo reproducido**: cuatro scripts usaban C:/SACRAMENTUM/SACRAMENTUM_FINAL, ruta inexistente en runner Linux.
- Seguridad de dependencias: fallo por 8 avisos npm audit.

Los cuatro scripts se corrigieron para utilizar process.cwd() y la estructura relativa del repositorio.

## Segunda ejecución: comprobación del arreglo

Commit: 84bbb16. Ejecución: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39633507031

- Trabajo pruebas-funcionales: **SUCCESS**. Incluyó npm ci, batería sintética de 206 controles, verificadores históricos aptos para CI y compilación Vite.
- Trabajo seguridad-dependencias: **FAILURE esperado**. npm audit --omit=dev --audit-level=moderate sigue encontrando 8 advertencias (6 altas y 2 moderadas).
- Verificador verify-latest-legacy-imports.mjs excluido expresamente de GitHub Actions porque requiere sesión autorizada Supabase. Se ejecutó localmente y comprobó denegación de acceso con la clave pública, sin contraseñas de usuario.

**Dictamen parcial:** la automatización de CI funciona y el trabajo funcional aprobó, pero la puerta global está roja por dependencias. No declarar release auditado al 100 % hasta resolver ese hallazgo.

El proceso automático no conoce las credenciales de producción y no inserta ningún registro sacramental.
