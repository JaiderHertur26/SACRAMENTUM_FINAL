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
const first = (...values) => values.find((value) => norm(value)) ?? '';

const parentText = (record) => {
  const raw = rawOf(record);
  return fullName(
    first(record?.nombrePadre, record?.nombre_padre, record?.groomFather, raw.nombrePadre, raw.padre),
    first(record?.nombreMadre, record?.nombre_madre, record?.groomMother, raw.nombreMadre, raw.madre)
  );
};

const registryRef = (record) => {
  const book = first(record?.Libro, record?.book_number, record?.bookNumber, record?.libro);
  const folio = first(record?.folio, record?.page_number, record?.pageNumber);
  const number = first(record?.numero, record?.number, record?.entry_number);
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

const getInstitution = async (parishId, fallback = {}) => {
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
  const nombres = first(record?.nombres, raw.nombres);
  const apellidos = first(record?.apellidos, raw.apellidos);
  const name = fullName(nombres, apellidos);
  const father = first(record?.nombrePadre, raw.nombrePadre, raw.padre);
  const mother = first(record?.nombreMadre, raw.nombreMadre, raw.madre);
  const padrino = first(raw.padrino, raw.godfather);
  const madrina = first(raw.madrina, raw.godmother);
  return {
    Nombres: nombres,
    Apellidos: apellidos,
    Nombre: name,
    Titular: name,
    Solicitante: name,
    Libro: first(record?.Libro, record?.book_number),
    Folio: first(record?.folio, record?.page_number),
    Numero: first(record?.numero, record?.number, record?.entry_number),
    FecNac: first(record?.fechaNacimiento, raw.fechaNacimiento),
    FechaNac: first(record?.fechaNacimiento, raw.fechaNacimiento),
    LugarNac: first(record?.lugarNacimiento, raw.lugarNacimiento),
    Padre: father,
    Madre: mother,
    ccPadre: first(record?.cedulaPadre, raw.cedulaPadre),
    ccMadre: first(record?.cedulaMadre, raw.cedulaMadre),
    Padres: fullName(father, father && mother ? 'y' : '', mother),
    Padrino: padrino,
    Madrina: madrina,
    Padrinos: first(record?.padrinos, raw.padrinos, fullName(padrino, padrino && madrina ? 'y' : '', madrina)),
    AbuePater: first(record?.abuelosPaternos, raw.abuelosPaternos),
    AbueMater: first(record?.abuelosMaternos, raw.abuelosMaternos),
    Ministro: first(record?.ministro, raw.ministro),
    DioFe: first(record?.daFe, raw.daFe, raw.dafe),
    FechaBau: first(record?.fechaSacramento, record?.celebration_date),
    ParroBau: first(record?.lugarBautismo, raw.lugarBautismo),
    TipoSexo: first(record?.sexo, raw.sexo),
    Cedula: first(record?.nuip, raw.nuip),
    Cedula3: first(record?.nuip, raw.nuip),
    Direccion: first(record?.direccion, raw.direccion),
    Year1: dateOnly(first(record?.fechaNacimiento, raw.fechaNacimiento)).slice(0,4),
    Year2: dateOnly(first(record?.fechaSacramento, record?.celebration_date)).slice(0,4),
  };
};

const confirmationValues = (record) => {
  const raw = rawOf(record);
  const nombres = first(record?.nombres, raw.nombres);
  const apellidos = first(record?.apellidos, raw.apellidos);
  const name = fullName(nombres, apellidos);
  const father = first(record?.nombrePadre, raw.nombrePadre);
  const mother = first(record?.nombreMadre, raw.nombreMadre);
  return {
    Nombres: nombres,
    Apellidos: apellidos,
    Nombre: name,
    Titular: name,
    Solicitante: name,
    Libro: first(record?.Libro, record?.book_number),
    Folio: first(record?.folio, record?.page_number),
    Numero: first(record?.numero, record?.number, record?.entry_number),
    FecNac: first(record?.fechaNacimiento, raw.fechaNacimiento),
    FechaNac: first(record?.fechaNacimiento, raw.fechaNacimiento),
    Padres: fullName(father, father && mother ? 'y' : '', mother),
    Padre: father,
    Madre: mother,
    Ministro: first(record?.ministro, raw.ministro),
    DioFe: first(record?.daFe, raw.daFe),
    Cedula: first(record?.nuip, raw.nuip),
    Year1: dateOnly(first(record?.fechaNacimiento, raw.fechaNacimiento)).slice(0,4),
    Year2: dateOnly(first(record?.fechaSacramento, record?.celebration_date)).slice(0,4),
  };
};

const marriageValues = (record) => {
  const raw = rawOf(record);
  const groom = fullName(first(record?.groomName, raw.novioNombres), first(record?.groomSurname, raw.novioApellidos));
  const bride = fullName(first(record?.brideName, raw.noviaNombres), first(record?.brideSurname, raw.noviaApellidos));
  return {
    Novio: groom,
    Novia: bride,
    Esposo: groom,
    Esposa: bride,
    ElContrayente: groom,
    LaContrayente: bride,
    Solicitante: groom,
    Pareja: bride,
    Cedula1: first(raw.novioCedula, raw.groomDocument),
    Cedula2: first(raw.noviaCedula, raw.brideDocument),
    Libro: first(record?.book_number, record?.Libro),
    Folio: first(record?.folio, record?.page_number),
    Numero: first(record?.number, record?.entry_number),
    FecMat: first(record?.sacramentDate, record?.celebration_date),
    FechaMatrimonio: first(record?.sacramentDate, record?.celebration_date),
    Ministro: first(record?.minister, record?.ministro),
    Delegado: first(record?.minister, record?.ministro),
    Parroco: first(record?.daFe, record?.da_fe),
    Confesion: first(raw.novioReligion, raw.noviaReligion),
    Contrayente: first(raw.novioEcclesialStatus === 'unbaptized' ? groom : '', raw.noviaEcclesialStatus === 'unbaptized' ? bride : ''),
  };
};

const funeralValues = (record) => {
  const raw = rawOf(record);
  const nombres = first(record?.nombres, raw.nombres, raw.nombre);
  const apellidos = first(record?.apellidos, raw.apellidos);
  return {
    Nombres: nombres,
    Apellidos: apellidos,
    Nombre: fullName(nombres, apellidos),
    Fechae: first(record?.fecha_exequias, raw.fechaExequias, record?.celebration_date),
    Fecham: first(record?.fecha_defuncion, raw.fechaDefuncion),
    Edad: first(record?.edad, raw.edad),
    Sexo: first(record?.sexo, raw.sexo),
    Padres: first(record?.padres, raw.padres, parentText(record)),
    Ministro: first(record?.ministro, raw.ministro),
    Libro: first(record?.book_number, record?.Libro),
    Folio: first(record?.folio, record?.page_number),
    Numero: first(record?.number, record?.entry_number),
  };
};

const dossierValues = (record) => {
  const data = record?.dossier_data || {};
  const pending = record?.pendingMarriage || {};
  const groom = data.groom || {};
  const bride = data.bride || {};
  const w1 = data.witness1 || {};
  const w2 = data.witness2 || {};
  const groomName = first(groom.fullName, fullName(pending.groomName, pending.groomSurname), fullName(pending.novioNombres, pending.novioApellidos));
  const brideName = first(bride.fullName, fullName(pending.brideName, pending.brideSurname), fullName(pending.noviaNombres, pending.noviaApellidos));
  const groomParents = fullName(groom.father, groom.father && groom.mother ? 'y' : '', groom.mother);
  const brideParents = fullName(bride.father, bride.father && bride.mother ? 'y' : '', bride.mother);
  const catholic = groom.baptismStatus === 'BAUTIZADO CATÓLICO' ? groomName
    : bride.baptismStatus === 'BAUTIZADO CATÓLICO' ? brideName : '';
  const other = catholic === groomName ? brideName : groomName;
  return {
    Novio: groomName,
    Novia: brideName,
    Esposo: groomName,
    Esposa: brideName,
    ElContrayente: groomName,
    LaContrayente: brideName,
    Solicitante: groomName,
    Pareja: brideName,
    Nombre1: groomName,
    Nombre2: brideName,
    Cedula1: first(groom.documentId, pending.novioCedula),
    Cedula2: first(bride.documentId, pending.noviaCedula),
    Direccion: first(groom.residenceAddress, bride.residenceAddress),
    Fecmat: first(record?.planned_marriage_date, pending.sacramentDate, pending.fechaSacramento),
    FechaMatrimonio: first(record?.planned_marriage_date, pending.sacramentDate, pending.fechaSacramento),
    Edad1: first(groom.age, ''),
    Edad2: first(bride.age, ''),
    Testigo1: w1.name,
    Testigo2: w2.name,
    Cedula3: groom.documentId,
    Parentesco1: w1.relationship,
    Parentesco2: w2.relationship,
    Padres: groomParents,
    PadresNovio: groomParents,
    PadresNovia: brideParents,
    Delegado: first(pending.minister, pending.ministro),
    Parroco: first(pending.daFe, pending.da_fe),
    Confesion: first(
      groom.religion && upper(groom.religion) !== 'CATÓLICA' ? groom.religion : '',
      bride.religion && upper(bride.religion) !== 'CATÓLICA' ? bride.religion : ''
    ),
    Contrayente: first(
      groom.baptismStatus === 'NO BAUTIZADO' ? groomName : '',
      bride.baptismStatus === 'NO BAUTIZADO' ? brideName : ''
    ),
    ParteCatolica: catholic,
    OtraParte: other,
    DocumentoCatolico: catholic === groomName ? groom.documentId : bride.documentId,
    DocumentoOtraParte: catholic === groomName ? bride.documentId : groom.documentId,
    Causa1: first(data.documents?.dispensations, data.act?.observations),
    Causa2: '',
    Causa3: '',
  };
};

export async function buildDocumentValuesFromRecord({ source, record, parishId, user = {} }) {
  const institution = await getInstitution(parishId, {
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
  return { ...common, ...specific };
}
