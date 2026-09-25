export const SACRAMENTUM_BRAND = Object.freeze({
  name: 'SACRAMENTUM',
  descriptor: 'Sistema Eclesial de Registro Sacramental',
  shortDescriptor: 'Registro Sacramental',
});

export const buildDocumentTitle = (section = '') => {
  const cleanSection = String(section || '').trim();
  return cleanSection ? `${cleanSection} · ${SACRAMENTUM_BRAND.name}` : SACRAMENTUM_BRAND.name;
};
