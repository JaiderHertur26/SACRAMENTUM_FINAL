# Investigación: Estructura de Partidas de Reposición en Eclesia

Este documento detalla la estructura, identificación y relaciones de las partidas de bautismo creadas por un decreto de reposición, basado en el análisis del código fuente actual del sistema.

## 1. Identificación de una Partida de Reposición

En el sistema, una partida se identifica como "Reposición" cumpliendo cualquiera de las siguientes condiciones (vistas en `BaptismPartidasPage.jsx` y `BaptismPrintTemplate.jsx`):

1. `type === "replacement"`
2. `createdByDecree === "replacement"`
3. Contiene la propiedad `newBaptismIdRepo` (legado/referencia)
4. Contiene la propiedad `replacesPartidaId` (con un ID válido o la cadena `"unknown"`)

## 2. Estructura Real de la Partida y Campos Específicos

Cuando se crea una nueva partida por decreto de reposición (analizado en `BaptismRepositionNewPage.jsx`), se genera un objeto de bautismo estándar pero enriquecido con banderas y metadatos específicos: