# SACRAMENTUM V316–V317 · Cierre de Notas Marginales de Repetición

## Corrección de ejecución real
La prueba de dos Bautismos reveló que `min(uuid)` no está definido en PostgreSQL. Se corrigió el RPC de asentamiento usando `(array_agg(id))[1]` tras comprobar cardinalidad. Migración V316 aplicada a Supabase.

## Prueba real transaccional, revertida
En la base se simuló un decreto que afectaba a **dos partidas digitales del mismo archivo**. Ambas notas se asentaron en `marginal_notes` dentro de una transacción revertida. El servidor rechazó: rol diocesano sin competencia, certificación física falsa de partida digital, segundo asiento duplicado y cierre con nota pendiente. Completadas ambas notas, el expediente pasó a `completed_documentary`. ROLLBACK final: ningún cambio persistente.

## Certificación de partidas sin efectos
V317 añade un trigger de integridad `trg_prevent_void_repetition_certificate_v317` en `registry_print_events`. Un intento de imprimir como `document_kind='partida'` una inscripción con nota activa `decree_repetition` y decreto activo se rechaza a nivel de base de datos. Prueba transaccional con inserción real: error específico de sin efectos registrales confirmado, ROLLBACK aplicado.

La vista de Bautismo y el diálogo de impresión diferencian `Vigente` de `Sin efectos por Decreto de Repetición`. Para una partida histórica sin efectos, se conserva consulta y nota; no se emite impresión de partida oficial. La lectura de notas es requisito antes de certificar, con estados de error conservadores y control de respuestas asíncronas al cambiar de partida. En el índice se consultan las notas de los registros de la página.

## Invariantes
No se ha eliminado ni editado un Bautismo, su libro, folio ni número. Los nuevos controles no modifican decretos existentes. No se crea ninguna partida externa ni se finge asiento físico.

## Resultados
- V312–V317: 34/34 pruebas automatizadas satisfactorias.
- Build Vite: correcto.
- Supabase: V316 y V317 instaladas; prueba real de funcionamiento y bloqueo de impresión con ROLLBACK.
- No se declara la aplicación apta para operación sacramental oficial: datos actuales de prueba y pruebas de interfaz autenticada aún sujetas a revisión.
