# SACRAMENTUM FINAL — PROTOCOLO DE INICIO CON BASE LIMPIA (V223)

## Regla absoluta de esta etapa
**Todos los registros de SACRAMENTUM actualmente existentes son datos de prueba; ninguno es oficial.** No se borrará, transferirá ni declarará oficial ningún registro por el simple hecho de desplegar el sitio. Un cambio de variable de entorno nunca debe suprimir la señalización de prueba de la base QA.

### Hallazgos verificados: base actual QA
- Proyecto técnico de pruebas: `foczofcmwampjvlfbsqn` (identificador público, no es una contraseña).
- **82 tablas públicas** inventariadas, **59 con filas**, **95.320 filas públicas** en total, **12 usuarios en auth.users**, **0 archivos en storage.objects** y **1 contenedor de storage**.
- La cuenta de filas es exacta, consultada con SELECT desde la consola privilegiada el 27 de octubre de 2026 (hora UTC) y guardada sin nombres de personas ni credenciales en `AUDITORIA_BASE_PRUEBAS_SOLO_LECTURA_V223.json`.
- Dentro del conjunto hay 5.040 bautismos, 2.091 confirmaciones, 1.261 matrimonios y 16.331 filas de importación histórica. **Nunca tratar esas cantidades como oficiales**.
- No ejecutar TRUNCATE, DELETE, DROP, `supabase db reset --linked` ni eliminación de usuarios en este proyecto durante V223.

## Arquitectura adoptada: producción desde cero, sin trasladar QA
1. **Congelar ensayos** antes del corte de versión; respaldar por los mecanismos autorizados el entorno QA para reproducir errores, sin copiar datos hacia la instalación nueva.
2. **Crear un proyecto Supabase NUEVO E INDEPENDIENTE**, exclusivamente para producción, cuando hayan aprobado las pruebas finales. No usar clone/restore desde QA porque copiaría registros y cuentas ficticios.
3. Reproducir únicamente **esquema, índices, políticas RLS, funciones, permisos, configuración y catálogos básicos revisados** desde migraciones versionadas. Revisar las 156 migraciones de la rama aprobada y toda siembra de plantillas; ninguna importación legacy QA ni cuenta de ensayo puede ejecutarse contra producción. El proyecto nuevo también requiere configuración independiente de Auth, SMTP, Storage, Edge Functions y secrets.
4. **Ejecutar el inventario de solo lectura** `scripts/release-inventory-readonly-v223.sql` desde un usuario con lectura completa en el proyecto NUEVO. La lectura desde `anon` o un perfil parroquial NO es suficiente porque RLS puede ocultar filas. Examinar el resultado completo, no solo las tablas de sacramentos.
5. Exigir: **82/82 tablas conocidas presentes**, 0 tablas faltantes o inesperadas; **0 filas operativas/de usuarios**, **0 usuarios Auth** y **0 objetos de Storage**. Los catálogos de plantillas sembrados por migraciones son la única excepción posible, previa auditoría de origen, contenido y versión. Nunca copiar los catálogos manuales de QA a ciegas.
6. La función `scripts/release-inventory-evaluator-v223.mjs` evalúa censos completos de manera determinista, pero devuelve siempre `approvedForOfficialUse:false`: un conteo no reemplaza la inspección ni el visto bueno institucional. Crear un acta externa de inventario y autorización del administrador después del cotejo.
7. **Publicación oficial, solo después de autorización:** la compilación ahora usa `guard-official-build-v223.mjs`; rechaza `VITE_REGISTRY_DATA_MODE=official` en QA, o sin acta V223 fresca, completa y correspondiente a otro proyecto independiente. Para el acta requiere variable privada de build `SACRAMENTUM_RELEASE_ATTESTATION_PATH` que señale el JSON validado localmente por el responsable. Esta puerta previene accidentes de configuración; no es firma criptográfica ni reemplaza las políticas RLS del backend.
8. Publicar la versión aprobada con la URL y clave **publicable** del nuevo proyecto, verificar nuevo host, autenticación, RLS, separación de jurisdicciones, los cuatro sacramentos, Cancillería, decretos, comunicación, notas, reportes, impresión y mensajes. Nunca poner service_role en el frontend.
9. **Solo entonces** crear de manera autorizada el primer Administrador General, su jerarquía institucional, cuentas diocesanas y parroquiales. Los numeradores/libros iniciales deben comenzar según las reglas parroquiales aprobadas, no reutilizar consecutivos de QA.
10. Las primeras partidas auténticas se registrarán **únicamente en el proyecto nuevo**, después del acta de puesta en marcha. Desde la primera partida real, quedan prohibidas las limpiezas experimentales y se activa el régimen de respaldo y recuperación.

## Criterios de bloqueo y recuperación
- Si una tabla nueva no aparece en el manifiesto (o falta alguna), el inicio oficial se bloquea.
- Si hay alguna cuenta/registro/nota/decreto/pendiente/mensaje/auditoría legacy de QA en el proyecto nuevo, el inicio oficial se bloquea.
- Si no se verificaron las identidades, se detectaron permisos inseguros, las dependencias presentan vulnerabilidades o falló un E2E real, no se autoriza el cambio.
- En un fallo anterior al primer registro real, revisar y reconstruir el proyecto limpio. Después del primer registro real: recuperación por respaldo, **nunca reset ni migración de datos de prueba desde QA**.
- El indicador `VITE_REGISTRY_DATA_MODE` es **presentacional** y no convierte ni acredita registros; la autorización jurídica y el aislamiento del servidor siempre se verifican por separado.

## Estado V223
Se implementaron inventario SQL de 82 tablas, evaluación de inventarios, precinto de documentos de QA y guard de compilación. **No se realizó ningún borrado en QA, ni se creó aún una base oficial, ni se transfirió un solo registro a producción.** El arranque limpio queda preparado técnicamente, pero requiere la certificación final y la puesta en marcha institucional.
