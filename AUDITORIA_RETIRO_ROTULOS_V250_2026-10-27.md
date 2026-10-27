# SACRAMENTUM FINAL — V250: supresión del antiguo rótulo de pruebas

**Fecha:** 27/10/2026. **Ámbito:** presentación web, pantallas de acceso, paneles y documentos generados.

## Cambios ejecutados
- Eliminado el aviso fijo de la pantalla pública de acceso (`PublicSearchPage.jsx`).
- Eliminado el aviso fijo de los paneles y de su layout compartido (`DashboardLayout.jsx`), incluidos los fragmentos de código destinados exclusivamente a mostrarlo.
- Retirada la leyenda anterior de los documentos HTML que usan estilos de impresión y de los PDF producidos con jsPDF.
- Sustituida por la marca documental `BORRADOR` y una nota de revisión en impresiones destinadas a pruebas, sin presentar documentos ficticios como partidas oficiales.
- Simplificada la ficha preliminar de cotejo histórico y conservadas las advertencias sobre su carácter investigativo y su prohibición de modificar registros.
- Actualizadas las pruebas de regresión V219, V220, V221 y V223, y añadido el control V250 a la auditoría maestra y a GitHub Actions.

## Evidencias
Búsqueda automática de antiguas frases en los archivos ejecutables del árbol `src`: **cero coincidencias**. V250 test 5/5, V219-V221 67/67, auditoría integral 30/30, build Vite correcto y npm audit producción 0 vulnerabilidades.

## Preservación de seguridad e historial
Las protecciones de lanzamiento `assessOfficialBuild`, el reconocimiento de la base Supabase QA, la cuarentena de funciones RPC, los permisos, los datos y las actas históricas permanecen sin cambios. No se altera la condición real de los registros ni se concede validez registral por quitar un texto visible. **Los documentos de ensayo solo pueden imprimirse como borradores.**

**Importante:** los informes de auditoría históricos y el historial SQL no se reescriben para borrar su procedencia; permanecen preservados como evidencia inmutable de las pruebas realizadas.
