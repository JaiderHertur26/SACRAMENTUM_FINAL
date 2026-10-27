import { isKnownTestRegistryProject } from './registryDataMode.mjs';

// V220. A clearly visible, non-juridical watermark on every generated TEST document.
// This describes the environment, not an authorization or a claim that records are official.
// The flag must be explicitly set to "official" for a future authorized launch.
export const isTestRegistryData = () => import.meta.env?.VITE_REGISTRY_DATA_MODE !== 'official'
  || isKnownTestRegistryProject(import.meta.env?.VITE_SUPABASE_URL);

export const testDocumentPrintCss = () => isTestRegistryData() ? `
/* V220: popup documents must carry their own stamp; they do not load the SPA CSS. */
body::before {
  content:"BORRADOR · COPIA DE REVISIÓN";
  position:fixed; top:3mm; left:0; right:0;
  text-align:center; font:900 10pt Arial, sans-serif;
  letter-spacing:.08em; color:#943b0e; z-index:2147483645;
  pointer-events:none;
}
@media print {
  body::after {
    content:"BORRADOR";
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%) rotate(-28deg);
    font:900 25pt Arial, sans-serif; color:rgba(125,70,45,.20);
    letter-spacing:.035em; white-space:nowrap;
    z-index:2147483646; pointer-events:none;
  }
}
` : '';

export function stampTestPdfPages(doc) {
  if (!isTestRegistryData()) return doc;
  const total = doc.getNumberOfPages();
  const previous = doc.getCurrentPageInfo().pageNumber;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let page=1;page<=total;page+=1) {
    doc.setPage(page);
    doc.setFont('helvetica','bold');
    doc.setFontSize(23);
    doc.setTextColor(205,196,187);
    doc.text('BORRADOR',w/2,h/2,{
      align:'center',angle:25,maxWidth:w-32
    });
    doc.setFontSize(7);
    doc.setTextColor(136,61,34);
    doc.text('COPIA DE REVISIÓN · NO APTO PARA EXPEDICIÓN',w/2,h-6,{align:'center'});
  }
  doc.setPage(previous);
  return doc;
}
