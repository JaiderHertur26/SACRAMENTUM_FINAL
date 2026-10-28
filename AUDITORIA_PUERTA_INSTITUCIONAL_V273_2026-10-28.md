# SACRAMENTUM FINAL — V273 · Puerta institucional de operación y despliegue atómico

Fecha: 28/10/2026. Rama: `feature/v252-ledger-state-foundation`. **NO hay mutaciones a la instancia Supabase ni inicio de operación oficial.**

## Trabajo realizado sobre datos REALES, solo lectura
- 82 tablas públicas clasificadas para el corte: **56 transaccionales de prueba a vaciar**; **26 maestras candidatas** a conservar, sin que «candidata» signifique que el contenido sea auténtico.
- Conteos exactos de las 26 tablas (consultados mediante SELECT): archdioceses 0; bishop_tenures 0; chancelleries 2; ciudades 1.500; conceptos_anulacion 4; deaneries 0; decanatos 3; dioceses 3; diocesis 103; directory_churches 1.138; directory_dioceses 103; document_templates 62; iglesias 1.138; legacy_priest_directory 4; legacy_reference_catalog 0; location_dictionary 1.502; marginal_note_template_clauses 6; marginal_note_templates 10; mis_datos 2; obispos 0; parish_parameters 6; parishes 6; parrocos 8; user_profiles 12; vicarias 3; vicariates 0.
- **Perfiles activos sin cuenta:** 8 perfiles `ACTIVE` de 12 están sin `auth_user_id` (4 de parroquia, 2 de diócesis, 1 admin_general y 1 de Cancillería). Los otros 4 están vinculados a cuentas existentes. No atribuir automáticamente estos perfiles a personas reales ni borrarlos sin verificar la identidad.
- Parroquias: 6, de las cuales 2 no figuran operativas y 1 tiene referencia a una importación ficticia (V268 ya prevé desvincular esa referencia). No se han tomado decisiones sobre qué instituciones son reales.
- Conceptos: 4, TODOS con `source_kind='legacy_catalog'` y 0 manuales. La autorización nueva V272 no puede concederse hasta que se configure el concepto institucional verdadero, tras revisión.
- Plantillas documentales: 62, de las cuales 30 tienen bandera legacy y 31 están inactivas; todas sin `parish_id` y `diocese_id` directos. No confundir una plantilla importada con un documento oficial.
- Diccionarios geográficos y directorios muy poblados pueden contener referencias útiles que no son partidas sacramentales; **no purgar automáticamente** bajo la etiqueta de «registro ficticio».

## V273 incorporado en el proyecto
1. `scripts/build-v273-master-inventory.mjs` produce `scripts/read-only-v273-institutional-master-inventory.sql`: inventario reproducible de los 26 conjuntos y controles de perfiles, parroquias, conceptos y plantillas sin SELECT de PII ni datos de partidas.
2. `scripts/staged-v273-institutional-master-review.sql` crea un registro PRIVADO de revisión por tabla, con **dos identificadores de responsables diferentes**, referencia verificable, cantidad exacta y huella MD5 del contenido. **La tabla no se rellena automáticamente en la base real**; el simulador inserta firmas marcadas inequívocamente como ficticias para poder ensayar.
3. El corte V267 ahora exige **exactamente 26 verificaciones de tablas** y coincidencia exacta del `row_count` y `hash` contra la fotografía preservada en el recibo V268. Vuelve a calcularlos de la base viva y hace abortar el corte si hay cambios posteriores. Además, bloquea **las 82 tablas públicas** durante esa comprobación y la revocación/grant de procedimientos, no solo las 56 transaccionales.
4. V267 aborta si hay perfiles `ACTIVE` sin una cuenta en `auth.users` o falta la tabla de autenticación; exige que las autorizaciones V272 existentes de pruebas estén vacías. No borra cuentas ni crea autenticaciones ficticias.
5. **Instalación atómica:** once artefactos SQL de los nuevos procedimientos (V263–V273) ahora realizan CREATE + REVOKE dentro de BEGIN/COMMIT, evitando una ventana de permisos por defecto entre sentencias. Los RPC `get_parish_ledger_seat_context_v264` y `attest_new_celebration_v265` NO conceden permisos antes de la activación; el corte V267 los otorga y verifica junto a los RPC de asientos, apertura y decretos.
6. `scripts/ci-fresh-official-start-v267.sh` agrega negativas en PostgreSQL 16 desechable: sin doble revisión, con identidad activa sin Auth, con una tabla institucional modificada tras firmarse, con tablas de prueba residuales o nuevas tablas no inventariadas. Verifica que los RPC antiguos siguen accesibles SOLO antes del corte (en el entorno sintético), los nuevos siguen bloqueados y en el corte se invierten los permisos atómicamente.
7. Las pruebas V273 y el gate V90 validan cada nueva condición y se integraron en GitHub CI.

## Orden de trabajo para la futura ventana oficial (no ejecutado)
- Primero completar identidad institucional real: identificar 8 perfiles sin auth, verificar quién debe estar activo y desactivar/configurar según corresponda, sin crear personas inventadas.
- Revisar formalmente los 26 conjuntos institucionales, aprobar conservar o rectificar datos que sean ficticios o incorrectos. No pasar por válido un directorio solo porque esté poblado.
- Congelar escrituras, producir backup íntegro externo, restaurarlo y cotejar su integridad.
- Instalar estructuras/RPC nuevos mediante transacciones atómicas, **manteniendo TODOS los permisos de nuevas operaciones bloqueados**.
- Ejecutar la limpieza V268 de 56 tablas de pruebas exclusivamente en la ventana autorizada y con respaldo restaurado.
- Documentar las 26 revisiones ligadas a hashes del recibo V268.
- Ejecutar V267 **solo** si pasa inventario vacío, identidades, firmas, permisos, índices físicos y ausencia de restos ficticios.
- Activar la compilación de interfaz correspondiente mediante configuración de despliegue, completar smoke tests por roles y constatar que el sistema viejo no ejecuta asientos.

**No se realizó ningún borrado, despliegue, fusión, cambio de roles ni habilitación oficial.** La base actual debe seguir disponible para simulación hasta que todos los criterios sean satisfechos.
