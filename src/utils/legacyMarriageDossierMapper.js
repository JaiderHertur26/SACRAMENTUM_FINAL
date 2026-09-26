const text = (value) => value == null ? '' : String(value).trim();

const yesNo = (value) => {
  if (value === true || value === 1 || value === '1') return 'SÍ';
  if (value === false || value === 0 || value === '0') return 'NO';
  const v = text(value).toUpperCase();
  if (['SI','SÍ','YES','TRUE'].includes(v)) return 'SÍ';
  if (['NO','FALSE'].includes(v)) return 'NO';
  return text(value);
};

const legacyInterview = (r, suffix) => ({
  datingDuration: text(r.pregun01),
  kinship: yesNo(r.pregun02),
  cohabitation: yesNo(r.pregun03),
  cohabitationDuration: text(r.pregun04),
  belongedOtherReligion: yesNo(r[`pregun1${suffix}`]),
  knowsFaithTruths: yesNo(r[`pregun2${suffix}`]),
  understandsSacrament: yesNo(r[`pregun3${suffix}`]),
  understandsUnityIndissolubility: yesNo(r[`pregun4${suffix}`]),
  understandsLifelong: yesNo(r[`pregun5${suffix}`]),
  understandsFamilyResponsibility: yesNo(r[`pregun6${suffix}`]),
  conditionedMarriage: yesNo(r[`pregun7${suffix}`]),
  freeConsent: yesNo(r[`pregun8${suffix}`]),
  familyAgreement: yesNo(r[`pregun9${suffix}`]),
  previousCohabitationOther: yesNo(r[`pregun10${suffix}`]),
  previousMarriage: (() => {
    const value = yesNo(r[`pregun11${suffix}`]);
    return value === 'SÍ' ? 'SÍ · LEGACY SIN TIPO' : value;
  })(),
  hasAdditionalDeclaration: yesNo(r[`pregun12${suffix}`]),
  observations: text(r[`declara${suffix}`] || r[`Declara${suffix}`]),
});

const legacyWitness = (r, suffix) => ({
  name: text(r[`dtnombre${suffix}`]),
  document: text(r[`dtcedula${suffix}`]),
  documentIssuedAt: text(r[`dtexpedida${suffix}`]),
  address: text(r[`dtdireccion${suffix}`]),
  city: text(r[`dtciudad${suffix}`]),
  phone: text(r[`dttelefono${suffix}`]),
  yearsKnownGroom: text(r[`dtpregun1${suffix}`]),
  yearsKnownBride: text(r[`dtpregun2${suffix}`]),
  knowsKinship: yesNo(r[`dtpregun3${suffix}`]),
  knowsPreviousMarriage: yesNo(r[`dtpregun4${suffix}`]),
  confirmsFreedom: yesNo(r[`dtpregun5${suffix}`]),
  knowsCoercion: yesNo(r[`dtpregun6${suffix}`]),
  knowsFaith: yesNo(r[`dtpregun7${suffix}`]),
  parentsAgree: yesNo(r[`dtpregun8${suffix}`]),
  hasAdditionalDeclaration: yesNo(r[`dtpregun9${suffix}`]),
  observations: text(r[`dtdeclara${suffix}`]),
});
const legacyParty = (r, suffix) => ({
  fullName: [r[`nombres${suffix}`], r[`apellidos${suffix}`]].map(text).filter(Boolean).join(' '),
  document: text(r[`cedula${suffix}`]),
  documentIssuedAt: text(r[`expedida${suffix}`]),
  baptismPlaceCode: text(r[`codbaut${suffix}`]),
  baptismDate: text(r[`fecbau${suffix}`]).slice(0,10),
  baptismBook: text(r[`libro${suffix}`]),
  baptismFolio: text(r[`folio${suffix}`]),
  baptismNumber: text(r[`numero${suffix}`]),
  fatherName: text(r[`padre${suffix}`]),
  motherName: text(r[`madre${suffix}`]),
  occupation: text(r[`ocupacion${suffix}`]),
  employer: text(r[`empresa${suffix}`]),
  address: text(r[`dir_res${suffix}`]),
  city: text(r[`ciudad${suffix}`]),
  phone: text(r[`telefonos${suffix}`]),
  confirmationPlaceCode: text(r[`codconf${suffix}`]),
});

export function mapLegacyInsmatriToDossierData(source = {}) {
  const r = source || {};
  return {
    groom: { ...legacyInterview(r, '1'), identification: legacyParty(r, '1') },
    bride: { ...legacyInterview(r, '2'), identification: legacyParty(r, '2') },
    witness1: legacyWitness(r, '1'),
    witness2: legacyWitness(r, '2'),
    documents: {
      groomBaptism: text(r.codbaut1 || r.lugbau1),
      brideBaptism: text(r.codbaut2 || r.lugbau2),
      groomConfirmation: text(r.codconf1),
      brideConfirmation: text(r.codconf2),
      premaritalCourse: text(r.cursoprem || r.curso || ''),
      civilDocuments: '',
      identityDocuments: '',
      proclamations: text(r.proclamas),
      dispensations: text(r.dispensas),
      licenses: text(r.licencias),
      previousMarriageProof: '',
      mixedMarriageRequirements: '',
      other: '',
    },
    act: {
      canonicalAssessment: '',
      impediments: text(r.impedimentos),
      dispensationsGranted: text(r.dispensas),
      declaration: text(r.declaracion),
      observations: text(r.observacio || r.observaciones),
      pastorCertification: text(r.dafe || r.parroco),
      legacyMinister: text(r.ministro),
      legacyMarriagePlace: text(r.lugmat),
      legacyMarriageDate: text(r.fecmat).slice(0,10),
    },
    legacy: {
      source: 'INSMATRI',
      entryNumber: text(r.numero),
      inscriptionDate: text(r.fecins).slice(0,10),
      preserved: true,
    },
  };
}
export function mergeLegacyDossierData(current = {}, legacySource = {}) {
  const mapped = mapLegacyInsmatriToDossierData(legacySource);
  const merge = (a, b) => {
    const out = { ...(a || {}) };
    for (const [key, value] of Object.entries(b || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = merge(out[key], value);
      } else if ((out[key] == null || out[key] === '') && value !== '') {
        out[key] = value;
      }
    }
    return out;
  };
  return merge(mapped, current || {});
}
