import { supabase } from '@/lib/supabaseClient';
import {
  getPendingBaptisms,
  purificarRegistroBautismo,
  purificarRegistroConfirmacion,
} from '@/services/sacramentsService';
import { listMarriagesCloud } from '@/services/marriagesCloudService';
import { getFuneralsCloud } from '@/services/funeralService';
import { loadMarriageDossierSources } from '@/services/marriageDossierService';

const SOURCE_LABELS = {
  baptism: 'Bautismos celebrados',
  pending_baptism: 'Bautismos por celebrar',
  confirmation: 'Confirmaciones celebradas',
  pending_confirmation: 'Confirmaciones por celebrar',
  marriage: 'Matrimonios celebrados',
  marriage_dossier: 'Expedientes matrimoniales',
  funeral: 'Exequias registradas',
  multi: 'Registro sacramental',
  manual: 'Documento sin partida vinculable',
};

const norm = (value) => String(value ?? '').trim();
const upper = (value) => norm(value).toUpperCase();
const dateOnly = (value) => value ? String(value).slice(0, 10) : '';
const today = () => new Intl.DateTimeFormat('es-CO', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const fullName = (...parts) => parts.map(norm).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
const rawOf = (record) => record?.raw_data || record?.rawData || {};
const normalizedOf = (record) => rawOf(record)?.legacy_normalized || {};
const resolvedOf = (record) => rawOf(record)?.legacy_resolved || {};
const first = (...values) => values.find((value) => norm(value)) ?? '';
const cleanCode = (value = '') => String(value || '').replace(/^LEGACY-/i, '').toUpperCase();

const splitName = (full = '') => {
  const value = norm(full);
  if (!value) return { names:'', surnames:'' };
  const parts = value.split(/\s+/);
  if (parts.length <= 2) return { names:parts[0] || '', surnames:parts.slice(1).join(' ') };
  const cut = Math.ceil(parts.length / 2);
  return { names:parts.slice(0, cut).join(' '), surnames:parts.slice(cut).join(' ') };
};

const calcAge = (birthDate, atDate = new Date()) => {
  if (!birthDate) return '';
  const birth = new Date(String(birthDate).slice(0, 10) + 'T00:00:00');
  const at = atDate instanceof Date ? atDate : new Date(String(atDate).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return '';
  let age = at.getFullYear() - birth.getFullYear();
  const beforeBirthday = at.getMonth() < birth.getMonth()
    || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? String(age) : '';
};

const parentText = (record) => {
  const raw = rawOf(record);
  const normalized = normalizedOf(record);
  return fullName(
    first(record?.nombrePadre, record?.nombre_padre, record?.groomFather, raw.nombrePadre, raw.nombre_padre, raw.padre, normalized.father_name),
    first(record?.nombreMadre, record?.nombre_madre, record?.groomMother, raw.nombreMadre, raw.nombre_madre, raw.madre, normalized.mother_name)
  );
};

const registryCoordinates = (record) => {
  const raw = rawOf(record);
  const normalized = normalizedOf(record);
  return {
    book: first(record?.Libro, record?.book_number, record?.bookNumber, record?.libro, raw.Libro, raw.book_number, raw.libro, normalized.book_number),
    folio: first(record?.folio, record?.page_number, record?.pageNumber, raw.folio, raw.page_number, normalized.folio),
    number: first(record?.numero, record?.number, record?.entry_number, raw.numero, raw.number, raw.entry_number, normalized.number)
  };
};

const registryRef = (record) => {
  const { book, folio, number } = registryCoordinates(record);
  return [book && `L. ${book}`, folio && `F. ${folio}`, number && `N. ${number}`].filter(Boolean).join(' · ');
};

export const getDocumentTemplateBinding = (template, overrideSource = '') => {
  const metadata = template?.metadata || {};
  const source = overrideSource || metadata.sacrament_source || 'manual';
  return {
    source,
    label: SOURCE_LABELS[source] || source,
    recordKind: metadata.record_kind || 'manual',
    allowedSources: Array.isArray(metadata.allowed_sources)
      ? metadata.allowed_sources
      : (source === 'multi' ? ['baptism','confirmation','marriage','funeral'] : []),
  };
};

export const getDocumentInstitution = async (parishId, fallback = {}) => {
  const result = {
    parishName: fallback.parishName || fallback.parish_name || '',
    dioceseName: fallback.dioceseName || fallback.diocese_name || '',
    city: fallback.city || fallback.parishCity || '',
  };
  if (!parishId) return result;
  const { data: parish } = await supabase
    .from('parishes')
    .select('name,city,diocese_id')
    .eq('id', parishId)
    .maybeSingle();
  if (parish) {
    result.parishName = parish.name || result.parishName;
    result.city = parish.city || result.city;
    if (parish.diocese_id) {
      const { data: diocese } = await supabase
        .from('dioceses')
        .select('name')
        .eq('id', parish.diocese_id)
        .maybeSingle();
      result.dioceseName = diocese?.name || result.dioceseName;
    }
  }
  return result;
};

const loadPendingConfirmations = async (parishId) => {
  if (!parishId) return [];
  const { data, error } = await supabase
    .from('pending_confirmations')
    .select('*')
    .eq('parish_id', parishId)
    .eq('reportado', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => {
    const raw = row.raw_data || {};
    return {
      ...purificarRegistroConfirmacion({
        ...raw,
        id: row.id,
        parish_id: row.parish_id,
        raw_data: raw,
        status: row.status || 'pending'
      }),
      status: row.status || 'pending',
      reportado: Boolean(row.reportado)
    };
  }).filter((row) => String(row?.status || 'pending').toLowerCase() === 'pending' && !row?.reportado);
};

const loadDossiers = async (parishId) => {
  const { dossiers, pending } = await loadMarriageDossierSources(parishId);
  const pendingById = new Map((pending || []).map((row) => [row.id, row]));
  return (dossiers || []).map((dossier) => ({
    ...dossier,
    pendingMarriage: pendingById.get(dossier.pending_marriage_id) || null,
  }));
};

const safeSearchTokens = (query) => upper(query)
  .split(/\s+/)
  .map((token) => token.replace(/[%_,()]/g, '').trim())
  .filter((token) => token.length >= 2)
  .slice(0, 4);

const queryCanonicalSacrament = async ({ table, parishId, query, limit, mapper }) => {
  let request = supabase
    .from(table)
    .select('*')
    .eq('parish_id', parishId)
    .order('created_at', { ascending: false })
    .limit(Math.max(20, Math.min(Number(limit) || 80, 250)));

  for (const token of safeSearchTokens(query)) {
    request = request.or(
      `nombres.ilike.%${token}%,apellidos.ilike.%${token}%,nuip.ilike.%${token}%,book_number.ilike.%${token}%,folio.ilike.%${token}%,number.ilike.%${token}%`
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data || []).map(mapper).filter(Boolean);
};

export async function loadDocumentSourceRecords({ source, parishId, query = '', limit = 80 }) {
  if (!parishId || !source || source === 'manual' || source === 'multi') return [];
  if (source === 'baptism') {
    return queryCanonicalSacrament({
      table:'baptisms',
      parishId,
      query,
      limit,
      mapper:purificarRegistroBautismo
    });
  }
  if (source === 'pending_baptism') {
    const rows = await getPendingBaptisms(parishId);
    return filterDocumentSourceRecords(
      (rows || []).filter((row) => String(row?.status || 'pending').toLowerCase() === 'pending' && !row?.reportado),
      source,
      query
    ).slice(0, limit);
  }
  if (source === 'confirmation') {
    return queryCanonicalSacrament({
      table:'confirmations',
      parishId,
      query,
      limit,
      mapper:purificarRegistroConfirmacion
    });
  }
  if (source === 'pending_confirmation') {
    const rows = await loadPendingConfirmations(parishId);
    return filterDocumentSourceRecords(rows, source, query).slice(0, limit);
  }
  if (source === 'marriage') {
    const rows = await listMarriagesCloud(parishId);
    return filterDocumentSourceRecords(rows, source, query).slice(0, limit);
  }
  if (source === 'marriage_dossier') {
    const rows = await loadDossiers(parishId);
    return filterDocumentSourceRecords(rows, source, query).slice(0, limit);
  }
  if (source === 'funeral') {
    const rows = await getFuneralsCloud(parishId);
    return filterDocumentSourceRecords(rows, source, query).slice(0, limit);
  }
  return [];
}

export const getDocumentRecordLabel = (record, source) => {
  const raw = rawOf(record);
  if (source === 'marriage_dossier') {
    const data = record?.dossier_data || {};
    const groom = first(
      data?.groom?.fullName,
      fullName(record?.pendingMarriage?.groomName, record?.pendingMarriage?.groomSurname),
      fullName(record?.pendingMarriage?.novioNombres, record?.pendingMarriage?.novioApellidos)
    );
    const bride = first(
      data?.bride?.fullName,
      fullName(record?.pendingMarriage?.brideName, record?.pendingMarriage?.brideSurname),
      fullName(record?.pendingMarriage?.noviaNombres, record?.pendingMarriage?.noviaApellidos)
    );
    return [record?.dossier_number && `EXP. ${record.dossier_number}`, fullName(groom, groom && bride ? '+' : '', bride), dateOnly(record?.planned_marriage_date)].filter(Boolean).join(' · ');
  }
  if (source === 'marriage') {
    const groom = fullName(record?.groomName, record?.groomSurname);
    const bride = fullName(record?.brideName, record?.brideSurname);
    return [fullName(groom, groom && bride ? '+' : '', bride), registryRef(record), dateOnly(record?.sacramentDate || record?.celebration_date)].filter(Boolean).join(' · ');
  }
  if (source === 'funeral') {
    const name = fullName(first(record?.nombres, raw.nombres, raw.nombre), first(record?.apellidos, raw.apellidos));
    return [name || record?.referenceName, registryRef(record), dateOnly(record?.fecha_exequias || record?.celebration_date)].filter(Boolean).join(' · ');
  }
  const name = fullName(first(record?.nombres, raw.nombres), first(record?.apellidos, raw.apellidos));
  return [name || record?.referenceName, registryRef(record), dateOnly(record?.fechaSacramento || record?.celebration_date)].filter(Boolean).join(' · ');
};

export const filterDocumentSourceRecords = (records, source, query) => {
  const term = upper(query);
  if (!term) return (records || []).slice(0, 250);
  const tokens = term.split(/\s+/).filter(Boolean);
  return (records || []).filter((record) => {
    const haystack = upper([
      getDocumentRecordLabel(record, source),
      JSON.stringify(record?.raw_data || {}),
      JSON.stringify(record?.dossier_data || {})
    ].join(' '));
    return tokens.every((token) => haystack.includes(token));
  }).slice(0, 250);
};

const commonInstitutionValues = (institution) => ({
  Miparroquia: institution?.parishName || '',
  MiParroquia: institution?.parishName || '',
  Parroquia: institution?.parishName || '',
  Miciudad: institution?.city || '',
  MiCiudad: institution?.city || '',
  Ciudad: institution?.city || '',
  Diocesis: institution?.dioceseName || '',
  Diócesis: institution?.dioceseName || '',
  Fecha: today(),
  FechaExp: today(),
});

const baptismValues = (record) => {
  const raw = rawOf(record);
  const normalized = normalizedOf(record);
  const resolved = resolvedOf(record);
  const coords = registryCoordinates(record);
  const nombres = first(record?.nombres, raw.nombres, normalized.names);
  const apellidos = first(record?.apellidos, raw.apellidos, normalized.last_names);
  const name = fullName(nombres, apellidos);
  const father = first(record?.nombrePadre, raw.nombrePadre, raw.padre, normalized.father_name);
  const mother = first(record?.nombreMadre, raw.nombreMadre, raw.madre, normalized.mother_name);
  const birthDate = first(record?.fechaNacimiento, raw.fechaNacimiento, raw.fecnac, normalized.birth_date);
  const baptismDate = first(record?.fechaSacramento, record?.celebration_date, raw.fechaSacramento, raw.fecbau, normalized.celebration_date);
  const baptismPlace = first(record?.lugarBautismo, raw.lugarBautismo, raw.lugbau, normalized.celebration_place);
  const birthPlace = first(record?.lugarNacimiento, raw.lugarNacimiento, raw.lugarn, raw.lugnac, normalized.birth_place);
  const combinedGodparents = first(record?.padrinos, raw.padrinos, normalized.godparents);
  const splitGodparents = String(combinedGodparents || '').split(/\s+Y\s+/i).map((item) => item.trim()).filter(Boolean);
  const padrino = first(raw.padrino, raw.godfather, splitGodparents.length === 2 ? splitGodparents[0] : '');
  const madrina = first(raw.madrina, raw.godmother, splitGodparents.length === 2 ? splitGodparents[1] : '');
  const godparents = first(combinedGodparents, fullName(padrino, padrino && madrina ? 'y' : '', madrina));
  const fatherDocument = first(record?.cedulaPadre, raw.cedulaPadre, raw.cedupad, normalized.father_document);
  const motherDocument = first(record?.cedulaMadre, raw.cedulaMadre, raw.cedumad, normalized.mother_document);
  const daFe = first(record?.daFe, raw.daFe, resolved.daFe, raw.dafe);
  const gender = first(record?.sexo, resolved.sexo, raw.sexo, normalized.gender);
  return {
    Nombres: nombres,
    Apellidos: apellidos,
    Nombre: name,
    Titular: name,
    Interesado: name,
    Solicitante: name,
    Libro: coords.book,
    Folio: coords.folio,
    Numero: coords.number,
    LibroBau: coords.book,
    FolioBau: coords.folio,
    NumeroBau: coords.number,
    FecNac: birthDate,
    FechaNac: birthDate,
    LugarNac: birthPlace,
    Padre: father,
    Madre: mother,
    ccPadre: fatherDocument,
    ccMadre: motherDocument,
    Padres: fullName(father, father && mother ? 'y' : '', mother),
    Padrino: padrino,
    Madrina: madrina,
    Padrinos: godparents,
    ccPadrino: first(raw.ccPadrino, raw.cedulaPadrino, raw.godfatherDocument),
    ccMadrina: first(raw.ccMadrina, raw.cedulaMadrina, raw.godmotherDocument),
    AbuePater: first(record?.abuelosPaternos, raw.abuelosPaternos, raw.abuepat, normalized.paternal_grandparents),
    AbueMater: first(record?.abuelosMaternos, raw.abuelosMaternos, raw.abuemat, normalized.maternal_grandparents),
    Ministro: first(record?.ministro, raw.ministro, normalized.minister),
    DioFe: daFe,
    FechaBau: baptismDate,
    ParroBau: baptismPlace,
    TipoSexo: gender,
    Cedula: first(record?.nuip, raw.nuip),
    Cedula3: first(record?.nuip, raw.nuip),
    Direccion: first(record?.direccion, raw.direccion, normalized.address),
    Year1: dateOnly(birthDate).slice(0,4),
    Year2: dateOnly(baptismDate).slice(0,4),
  };
};

const confirmationValues = (record) => {
  const raw = rawOf(record);
  const normalized = normalizedOf(record);
  const resolved = resolvedOf(record);
  const coords = registryCoordinates(record);
  const nombres = first(record?.nombres, raw.nombres, normalized.names);
  const apellidos = first(record?.apellidos, raw.apellidos, normalized.last_names);
  const name = fullName(nombres, apellidos);
  const father = first(record?.nombrePadre, raw.nombrePadre, raw.padre, normalized.father_name);
  const mother = first(record?.nombreMadre, raw.nombreMadre, raw.madre, normalized.mother_name);
  const birthDate = first(record?.fechaNacimiento, raw.fechaNacimiento, raw.fecnac, normalized.birth_date);
  const confirmationDate = first(record?.fechaSacramento, record?.celebration_date, raw.fechaSacramento, raw.fechaConfirmacion, raw.feccon, normalized.celebration_date);
  return {
    Nombres: nombres,
    Apellidos: apellidos,
    Nombre: name,
    Titular: name,
    Interesado: name,
    Solicitante: name,
    Libro: coords.book,
    Folio: coords.folio,
    Numero: coords.number,
    FecNac: birthDate,
    FechaNac: birthDate,
    Padres: fullName(father, father && mother ? 'y' : '', mother),
    Padre: father,
    Madre: mother,
    Ministro: first(record?.ministro, raw.ministro, normalized.minister),
    DioFe: first(record?.daFe, raw.daFe, resolved.daFe, raw.dafe),
    Cedula: first(record?.nuip, raw.nuip),
    Edad: first(record?.edad, raw.edad, normalized.age_text, calcAge(birthDate, confirmationDate)),
    FechaCon: confirmationDate,
    FechaConfirmacion: confirmationDate,
    LibroBau: first(raw.libroBautismo, raw.libbau, normalized.baptism_book),
    FolioBau: first(raw.folioBautismo, raw.folbau, normalized.baptism_folio),
    NumeroBau: first(raw.numeroBautismo, raw.numbau, normalized.baptism_number),
    ParroBau: first(raw.lugarBautismo, raw.lugbau, normalized.baptism_place),
    Padrinos: first(record?.padrinos, raw.padrinos, raw.padri, normalized.sponsor),
    Year1: dateOnly(birthDate).slice(0,4),
    Year2: dateOnly(confirmationDate).slice(0,4),
  };
};

const marriageValues = (record) => {
  const raw = rawOf(record);
  const normalized = normalizedOf(record);
  const coords = registryCoordinates(record);
  const groom = fullName(
    first(record?.groomName, raw.novioNombres, raw.nombres1, normalized.party_1?.names),
    first(record?.groomSurname, raw.novioApellidos, raw.apellidos1, normalized.party_1?.last_names)
  );
  const bride = fullName(
    first(record?.brideName, raw.noviaNombres, raw.nombres2, normalized.party_2?.names),
    first(record?.brideSurname, raw.noviaApellidos, raw.apellidos2, normalized.party_2?.last_names)
  );
  const marriageDate = first(record?.sacramentDate, record?.celebration_date, raw.fechaSacramento, raw.fecmat);
  return {
    Novio: groom,
    Novia: bride,
    Esposo: groom,
    Esposa: bride,
    ElContrayente: groom,
    LaContrayente: bride,
    Interesado: fullName(groom, groom && bride ? 'y' : '', bride),
    Solicitante: groom,
    Pareja: bride,
    Cedula1: first(raw.novioCedula, raw.cedula1, raw.groomDocument),
    Cedula2: first(raw.noviaCedula, raw.cedula2, raw.brideDocument),
    Libro: coords.book,
    Folio: coords.folio,
    Numero: coords.number,
    FecMat: marriageDate,
    Fecmat: marriageDate,
    FechaMatrimonio: marriageDate,
    Ministro: first(record?.minister, record?.ministro, raw.ministro),
    Delegado: first(record?.minister, record?.ministro, raw.ministro),
    Parroco: first(record?.daFe, record?.da_fe, raw.daFe, raw.dafe),
    Confesion: first(raw.novioReligion, raw.noviaReligion, raw.otrareligi, raw.otrarelig2),
    Contrayente: first(
      raw.novioEcclesialStatus === 'unbaptized' ? groom : '',
      raw.noviaEcclesialStatus === 'unbaptized' ? bride : '',
      raw.bautizado1 === false ? groom : '',
      raw.bautizado2 === false ? bride : ''
    ),
  };
};

const funeralValues = (record) => {
  const raw = rawOf(record);
  const coords = registryCoordinates(record);
  const nombres = first(record?.nombres, raw.nombres, raw.nombre);
  const apellidos = first(record?.apellidos, raw.apellidos);
  const deathDate = first(record?.fecha_defuncion, raw.fecha_defuncion, raw.fechaDefuncion);
  const funeralDate = first(record?.fecha_exequias, raw.fecha_exequias, raw.fechaExequias, record?.celebration_date);
  const birthDate = first(record?.fecha_nacimiento, raw.fecha_nacimiento, raw.fechaNacimiento);
  const ageValue = first(record?.edad, raw.edad, raw.edadDeclarada, calcAge(birthDate, deathDate || funeralDate));
  const ageUnit = first(raw.tipoEdad, raw.tipo_edad);
  return {
    Nombres: nombres,
    Apellidos: apellidos,
    Nombre: fullName(nombres, apellidos),
    Titular: fullName(nombres, apellidos),
    Interesado: fullName(nombres, apellidos),
    Solicitante: fullName(nombres, apellidos),
    Fechae: funeralDate,
    Fecham: deathDate,
    Edad: ageValue ? fullName(ageValue, ageUnit) : '',
    Sexo: first(record?.sexo, raw.sexo),
    Padres: first(record?.padres, raw.padres, parentText(record)),
    Ministro: first(record?.ministro, raw.ministro),
    Libro: coords.book,
    Folio: coords.folio,
    Numero: coords.number,
    LugarExequias: first(record?.lugar_exequias, raw.lugar_exequias, raw.lugarExequias),
    LugarDefuncion: first(record?.lugar_defuncion, raw.lugar_defuncion, raw.lugarDefuncion),
    Cementerio: first(record?.cementerio, raw.cementerio),
    EstadoCivil: first(record?.estadoCivil, raw.estadoCivil, raw.estado_civil),
    Conyuge: first(record?.conyuge, raw.conyuge),
  };
};

const dossierValues = (record) => {
  const data = record?.dossier_data || {};
  const pending = record?.pendingMarriage || {};
  const groom = data.groom || {};
  const bride = data.bride || {};
  const w1 = data.witness1 || {};
  const w2 = data.witness2 || {};
  const plannedDate = first(record?.planned_marriage_date, pending.sacramentDate, pending.fechaSacramento, pending.fechaHoraPrevista);
  const groomName = first(groom.fullName, fullName(pending.groomName, pending.groomSurname), fullName(pending.novioNombres, pending.novioApellidos));
  const brideName = first(bride.fullName, fullName(pending.brideName, pending.brideSurname), fullName(pending.noviaNombres, pending.noviaApellidos));
  const groomParents = fullName(groom.father, groom.father && groom.mother ? 'y' : '', groom.mother);
  const brideParents = fullName(bride.father, bride.father && bride.mother ? 'y' : '', bride.mother);
  const groomCatholic = ['BAUTIZADO CATÓLICO','CATHOLIC_BAPTIZED'].includes(upper(groom.baptismStatus || pending.novioEcclesialStatus));
  const brideCatholic = ['BAUTIZADO CATÓLICO','CATHOLIC_BAPTIZED'].includes(upper(bride.baptismStatus || pending.noviaEcclesialStatus));
  const catholic = groomCatholic ? groomName : brideCatholic ? brideName : '';
  const other = catholic === groomName ? brideName : catholic === brideName ? groomName : '';
  return {
    Novio: groomName,
    Novia: brideName,
    Esposo: groomName,
    Esposa: brideName,
    ElContrayente: groomName,
    LaContrayente: brideName,
    Interesado: fullName(groomName, groomName && brideName ? 'y' : '', brideName),
    Solicitante: groomName,
    Pareja: brideName,
    Nombre1: groomName,
    Nombre2: brideName,
    Nombres: splitName(groomName).names,
    Apellidos: splitName(groomName).surnames,
    Cedula1: first(groom.documentId, pending.novioCedula),
    Cedula2: first(bride.documentId, pending.noviaCedula),
    Direccion: first(groom.residenceAddress, bride.residenceAddress, pending.novioDireccion, pending.noviaDireccion),
    Fecmat: plannedDate,
    FecMat: plannedDate,
    FechaMatrimonio: plannedDate,
    Edad1: first(groom.age, calcAge(groom.birthDate, plannedDate)),
    Edad2: first(bride.age, calcAge(bride.birthDate, plannedDate)),
    Testigo1: w1.name,
    Testigo2: w2.name,
    DocumentoTestigo1: w1.document,
    DocumentoTestigo2: w2.document,
    Cedula3: first(groom.documentId, pending.novioCedula),
    Parentesco1: w1.relationship,
    Parentesco2: w2.relationship,
    Padres: groomParents,
    PadresNovio: groomParents,
    PadresNovia: brideParents,
    Delegado: first(pending.minister, pending.ministro, pending.presenciaria),
    Parroco: first(pending.daFe, pending.da_fe),
    Confesion: first(
      groom.religion && upper(groom.religion) !== 'CATÓLICA' ? groom.religion : '',
      bride.religion && upper(bride.religion) !== 'CATÓLICA' ? bride.religion : '',
      pending.novioReligion,
      pending.noviaReligion
    ),
    Contrayente: first(
      upper(groom.baptismStatus) === 'NO BAUTIZADO' ? groomName : '',
      upper(bride.baptismStatus) === 'NO BAUTIZADO' ? brideName : '',
      pending.novioEcclesialStatus === 'unbaptized' ? groomName : '',
      pending.noviaEcclesialStatus === 'unbaptized' ? brideName : ''
    ),
    ParteCatolica: catholic,
    OtraParte: other,
    DocumentoCatolico: catholic === groomName ? first(groom.documentId, pending.novioCedula) : catholic === brideName ? first(bride.documentId, pending.noviaCedula) : '',
    DocumentoOtraParte: catholic === groomName ? first(bride.documentId, pending.noviaCedula) : catholic === brideName ? first(groom.documentId, pending.novioCedula) : '',
    Causa1: first(data.documents?.dispensations, data.act?.observations, data.authorization?.decreeIssuer),
    Causa2: '',
    Causa3: '',
  };
};

const templateSpecificValues = ({ templateCode, source, record, base, subjectRole = 'groom', currentPriestName = '' }) => {
  const code = cleanCode(templateCode);
  const extra = {};

  if (['73021','73022','73023'].includes(code)) {
    extra.Labor = 'corrección';
  }

  if (code === '73031' && (source === 'baptism' || source === 'pending_baptism')) {
    extra.LibroBau = base.Libro;
    extra.FolioBau = base.Folio;
    extra.NumeroBau = base.Numero;
  }

  if (code === '73071') {
    const typeLabel = {
      baptism:'Bautismo',
      confirmation:'Confirmación',
      marriage:'Matrimonio',
      funeral:'Exequias'
    }[source] || '';
    extra.Partida = typeLabel;
    extra.Interesado = first(base.Interesado, base.Titular, base.Nombre, fullName(base.Esposo, base.Esposa));
    extra.Solicitante = first(base.Solicitante, extra.Interesado);
  }

  if (code === '71012' && source === 'marriage_dossier') {
    const data = record?.dossier_data || {};
    const pending = record?.pendingMarriage || {};
    const party = subjectRole === 'bride' ? (data.bride || {}) : (data.groom || {});
    const w1 = data.witness1 || {};
    const w2 = data.witness2 || {};
    const fallbackFull = subjectRole === 'bride'
      ? fullName(pending.noviaNombres, pending.noviaApellidos)
      : fullName(pending.novioNombres, pending.novioApellidos);
    const person = first(party.fullName, fallbackFull);
    const split = splitName(person);
    extra.Nombres = split.names;
    extra.Apellidos = split.surnames;
    extra.Cedula3 = first(party.documentId, subjectRole === 'bride' ? pending.noviaCedula : pending.novioCedula);
    extra.Padres = fullName(party.father, party.father && party.mother ? 'y' : '', party.mother);
    extra.Testigo1 = w1.name;
    extra.Testigo2 = w2.name;
    extra.Cedula1 = w1.document;
    extra.Cedula2 = w2.document;
    extra.Parentesco1 = w1.relationship;
    extra.Parentesco2 = w2.relationship;
    extra.Solicitante = person;
    extra.Interesado = person;
  }

  if (currentPriestName) {
    extra.Parroco = first(base.Parroco, currentPriestName);
  }

  return extra;
};

export const EXPECTED_MANUAL_TEMPLATE_FIELDS = {
  '71061':['Nombre','Cedula','Expedido'],
  '71071':['Tipopartida','Nombre'],
  '71091':['Testigo1','Cedula1','Testigo2','Cedula2','Parentesco1','Parentesco2'],
  '71132':['ccPadrino','ccMadrina'],
  '72011':['Causa1','Causa2','Causa3'],
  '72021':['Causa1','Causa2','Causa3'],
  '72031':['Causa1','Causa2','Causa3'],
  '72061':['Causa1','Causa2','Causa3'],
  '73011':['Efecto'],
  '73012':['Efecto'],
  '73013':['Efecto'],
  '73071':['Motivo','Efectos']
};

export async function buildDocumentValuesFromRecord({
  source,
  record,
  parishId,
  user = {},
  templateCode = '',
  subjectRole = 'groom',
  currentPriestName = ''
}) {
  const institution = await getDocumentInstitution(parishId, {
    parishName: user?.parishName,
    dioceseName: user?.dioceseName || user?.diocese_name,
    city: user?.city || user?.parishCity,
  });
  const common = commonInstitutionValues(institution);
  let specific = {};
  if (source === 'baptism' || source === 'pending_baptism') specific = baptismValues(record);
  else if (source === 'confirmation' || source === 'pending_confirmation') specific = confirmationValues(record);
  else if (source === 'marriage') specific = marriageValues(record);
  else if (source === 'marriage_dossier') specific = dossierValues(record);
  else if (source === 'funeral') specific = funeralValues(record);

  const base = { ...common, ...specific };
  return {
    ...base,
    ...templateSpecificValues({
      templateCode,
      source,
      record,
      base,
      subjectRole,
      currentPriestName
    })
  };
}
