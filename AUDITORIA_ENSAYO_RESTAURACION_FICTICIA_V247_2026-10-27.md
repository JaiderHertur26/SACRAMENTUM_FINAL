# SACRAMENTUM FINAL — V247: ensayo material de backup/restauración con PostgreSQL

**Fecha:** 27/10/2026. **Estado:** infraestructura de recuperación ficticia en CI. No restaura Supabase QA ni una instalación oficial.

## Qué prueba V247
Un job independiente de GitHub Actions utiliza la imagen PostgreSQL 16 y dos bases distintas dentro del mismo contenedor desechable. Carga exclusivamente registros ficticios de parroquias, Bautismo, Confirmación, Matrimonio, Exequias, decretos y documentos emitidos; crea un respaldo con `pg_dump -Fc`, verifica su integridad SHA-256, comprueba detección de alteración deliberada, restaura con `pg_restore --single-transaction --exit-on-error` y compara conteos y una huella reproducible de cuatro tablas.

También exige que la restauración conserve las relaciones mediante claves foráneas, unicidad de coordenadas de partidas, índices, activación de RLS, políticas y la restricción de lectura parroquial. La prueba crea y elimina automáticamente sus archivos temporales. No utiliza credenciales ni direcciones de Supabase, documentos reales ni secretos institucionales.

**Limitación esencial:** aunque el contenedor ejecuta PostgreSQL real, el respaldo es deliberadamente artificial, no procede de la base QA ni de una base de producción. En consecuencia esta prueba valida la técnica de backup/restauración y no permite declarar cumplido el plan institucional de recuperación. La prueba oficial requerirá credenciales administrativas gestionadas con seguridad, exportación consistente autorizada, destino aislado, restauración del esquema auténtico completo (incluida Auth/Storage según corresponda), recuperación de claves y evidencia de integridad de los registros.

## Estado paralelo: V246
La corrección V246 para la fuga de existencia en la anulación de documentos continúa en la **PR en borrador #97**, NO aplicada en la base. La herramienta impidió la migración y no se intentó otra ruta. No debe fusionarse ni considerarse desplegada hasta autorización, QA viva y ajuste del guard de 152 RPC.

El repositorio `main` y Supabase QA permanecen oficialmente en V245, y la habilitación de registros oficiales sigue bloqueada.

**Estimación técnica documental previa:** 97,41 %. Las pruebas reales del job V247 pueden incorporar nueva evidencia, pero no acreditan todavía recuperación institucional ni elevan automáticamente el porcentaje.
