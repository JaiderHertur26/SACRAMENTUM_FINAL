import { isKnownTestRegistryProject } from './registryDataMode.mjs';

// El modo de datos permanece identificado incluso si no se imprimen avisos
// repetitivos en el contenido visual. Las reglas de inicio oficial, permisos,
// seguridad, integridad y jurisdiccion se validan en capas independientes.
export const isTestRegistryData = () => import.meta.env?.VITE_REGISTRY_DATA_MODE !== 'official'
  || isKnownTestRegistryProject(import.meta.env?.VITE_SUPABASE_URL);

// Compatibilidad con todos los generadores HTML y PDF existentes.
// No introduce rotulos visuales adicionales en las plantillas eclesiales.
export const testDocumentPrintCss = () => '';
export function stampTestPdfPages(doc) {
  return doc;
}
