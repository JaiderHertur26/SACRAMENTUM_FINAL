# INVESTIGACIÓN: BOTÓN "GUARDAR DECRETO"
**Ruta:** `/parish/decree-correction/new`

## 1. COMPONENTE PRINCIPAL
- **Archivo:** `src/pages/parish/BaptismCorrectionNewPage.jsx`
- **Descripción:** Este componente actúa como el formulario principal para la creación de nuevos Decretos de Corrección a nivel parroquial. Permite buscar una partida existente (Bautismo, Confirmación o Matrimonio), anularla y generar automáticamente una nueva partida en el libro supletorio vinculada al decreto de corrección.

## 2. FLUJO DE EJECUCIÓN DETALLADO
*(Nota: El flujo se describe basado en la pestaña de Bautizos, que ejecuta la función `handleSave`. El comportamiento es simétrico para Confirmaciones y Matrimonios con `handleConfSave` y `handleMarSave` respectivamente).*

1. **Interacción del Usuario:** El usuario hace clic en el botón `<Button onClick={handleSave}>Guardar Decreto</Button>`.
2. **Validación Inicial (`validateForm`):** 
   - Se verifica que existan los datos obligatorios del decreto (`decreeNumber`, `decreeDate`, `conceptoAnulacionId`, `targetName`).
   - Se asegura de que se haya buscado y seleccionado una partida a corregir (`foundRecord` no es nulo).
   - Se verifica que el formulario de la nueva partida (supletorio) tenga sus campos obligatorios diligenciados.
3. **Validación de Duplicidad:** Se consulta `getBaptismCorrections` para comprobar que el número de decreto ingresado no exista previamente.
4. **Inicio de Carga:** Se activa el estado `setIsLoading(true)` para deshabilitar el botón y mostrar el indicador de carga.
5. **Estructuración de Datos (`partidaToSave`):** Se mapean los campos del estado local `newPartida` a las claves esperadas por el esquema subyacente (ej. `firstName` -> `nombres`, `birthDate` -> `fecnac`), estableciendo campos automáticos como `anulado: false` y `status: 'seated'`.
6. **Llamada al Contexto (`createBaptismCorrection`):** Se invoca el método del `AppDataContext` pasando los datos del decreto, el ID de la partida original, los datos de la nueva partida y el ID de la parroquia.
7. **Procesamiento en Contexto (`AppDataContext.jsx`):**
   - Se localiza la partida original en el almacenamiento y se marca como anulada (`isAnnulled: true`, `status: 'anulada'`) vinculándola al decreto.
   - Se obtienen los parámetros de numeración del libro supletorio (`baptismParameters`).
   - Se genera la nueva partida asimilando la numeración supletoria actual.
   - Se incrementa el contador del libro supletorio (`incrementPaddedValue`).
   - Se crea el registro del Decreto conectando la partida original y la nueva.
   - Se guardan todos los cambios en `localStorage` (`baptisms_`, `baptismParameters_`, `baptismCorrections_`).
8. **Finalización y Respuesta:** El contexto retorna un objeto `{ success: true/false, message, data }`.
9. **Manejo de UI:** 
   - Se desactiva el estado de carga (`setIsLoading(false)`).
   - Si es exitoso: Se lanza un `toast` de éxito y se redirige con `navigate('/parroquia/decretos/ver-correcciones')`.
   - Si falla: Se lanza un `toast` destructivo mostrando el error.

## 3. ARCHIVOS AFECTADOS
- **`src/pages/parish/BaptismCorrectionNewPage.jsx`**: Componente de interfaz de usuario donde reside el botón, el formulario y la validación primaria.
- **`src/context/AppDataContext.jsx`**: Proveedor de contexto que contiene la lógica de negocio (`createBaptismCorrection`, `getBaptismCorrections`), acceso y persistencia de datos (actualmente `localStorage`).
- **`src/utils/supabaseHelpers.js`**: Provee utilidades esenciales usadas en el proceso como `generateUUID` (para generar IDs de nuevas partidas y decretos) y `incrementPaddedValue` (para autoincrementar el número de partida supletoria).
- **`src/components/ui/use-toast.js`**: Hook encargado de mostrar notificaciones emergentes de éxito o error al usuario.

## 4. MÉTODOS Y FUNCIONES

| Función | Ubicación | Parámetros | Retorna | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `handleSave` | `BaptismCorrectionNewPage.jsx` | Ninguno (evento implícito) | `void` | Orquesta la validación, preparación de datos y llamada al contexto. |
| `validateForm` | `BaptismCorrectionNewPage.jsx` | Ninguno | `boolean` | Verifica que los campos requeridos no estén vacíos. |
| `getBaptismCorrections`| `AppDataContext.jsx` | `parishId` (String) | `Array` | Obtiene la lista de decretos existentes para validar duplicados. |
| `createBaptismCorrection`| `AppDataContext.jsx` | `decreeData` (Obj), `originalPartidaId` (String), `newPartidaData` (Obj), `parishId` (String) | `Object {success, message, data}` | Modifica la partida original, crea la nueva partida supletoria y crea el registro del decreto. |
| `generateUUID` | `supabaseHelpers.js` | Ninguno | `String` (UUID v4) | Genera identificadores únicos para los nuevos registros. |
| `incrementPaddedValue` | `supabaseHelpers.js` | `value` (String), `step` (Number) | `String` | Incrementa numéricamente conservando los ceros a la izquierda (ej. "005" -> "006"). |

## 5. ESTRUCTURA DE DATOS

**Ejemplo de los datos del Decreto guardados en `baptismCorrections_{parishId}`:**