import {
  BARRANQUILLA_DIOCESE_ID,
  BARRANQUILLA_NAME,
  BARRANQUILLA_CREST
} from '../lib/institutionalBranding.js';

// Sólo los decretos expedidos por la Cancillería de esta Arquidiócesis
// reciben el escudo. Ni el usuario que los lee ni una etiqueta textual
// del encabezado pueden conferir esa identidad institucional.
const VALID_CHANCERY_OFFICES = new Set(['canciller', 'vice_canciller']);

export const isBarranquillaChanceryDecree = (row = {}) => {
  const issuerDioceseId = String(row?.diocese_id || '').trim().toLowerCase();
  const office = String(row?.payload?.issuingSigner?.office || '').trim().toLowerCase();
  const historical = row?.payload?.historical === true ||
    row?.payload?.recordOrigin === 'historical_archive';
  return !historical && issuerDioceseId === BARRANQUILLA_DIOCESE_ID &&
    VALID_CHANCERY_OFFICES.has(office);
};

export const decreeInstitutionBranding = (row = {}) =>
  isBarranquillaChanceryDecree(row)
    ? { crestSrc: BARRANQUILLA_CREST, dioceseName: BARRANQUILLA_NAME }
    : null;
