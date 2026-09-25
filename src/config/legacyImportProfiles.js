const upper = (value) => String(value ?? '').trim().toUpperCase();
const text = (value) => value == null ? '' : String(value).trim();
const boolish = (value) => value === true || value === 1 || value === '1' || upper(value) === 'TRUE' || upper(value) === 'SI' || upper(value) === 'SÍ';
const sex = (value) => {
  const v = upper(value);
  if (v === '1' || v === 'M' || v.includes('MASC')) return 'MASCULINO';
  if (v === '2' || v === 'F' || v.includes('FEM')) return 'FEMENINO';
  return v || '';
};
const unionType = (value) => {
  const v = String(value ?? '').trim();
  const map = { '1': 'MATRIMONIO CATÓLICO', '2': 'MATRIMONIO CIVIL', '3': 'UNIÓN LIBRE', '4': 'MADRE SOLTERA', '5': 'OTRO CASO' };
  return map[v] || upper(v);
};
const dateOnly = (value) => {
  if (!value) return '';
  const v = String(value).trim();
  return v.includes('T') ? v.split('T')[0] : v;
};
const safeLegacyDate = (value) => {
  const v = dateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : v;
};
const sourceKey = (...parts) => parts.map(v => text(v)).join('|');
const cleanCode = (value) => text(value).replace(/\.0$/, '');
const splitLegacyPriestName = (value) => {
  const fullName = text(value).replace(/\s+/g, ' ').trim();
  if (!fullName) {
    return {
      priest_name: '',
      priest_given_names: '',
      priest_surnames: '',
      priest_honorific: '',
      name_split_confidence: 'empty'
    };
  }

  const honorificMatch = fullName.match(/^(PBRO\.?|PRESB\.?|PRESBÍTERO|PADRE|P\.)\s+/i);
  const honorific = honorificMatch ? upper(honorificMatch[1]).replace(/^PBRO$/, 'PBRO.') : '';
  const body = honorificMatch ? fullName.slice(honorificMatch[0].length).trim() : fullName;
  const parts = body.split(/\s+/).filter(Boolean);
  const particles = new Set(['DE','DEL','LA','LAS','LOS','Y','SAN','SANTA']);

  const hasAmbiguousParticle = parts.slice(1, -1).some((part) => particles.has(upper(part)));
  const canSplit = parts.length >= 3 && !hasAmbiguousParticle;

  if (!canSplit) {
    return {
      priest_name: fullName,
      priest_given_names: body,
      priest_surnames: '',
      priest_honorific: honorific,
      name_split_confidence: 'review'
    };
  }

  const givenNames = parts.slice(0, -2).join(' ');
  const surnames = parts.slice(-2).join(' ');
  return {
    priest_name: fullName,
    priest_given_names: givenNames,
    priest_surnames: surnames,
    priest_honorific: honorific,
    name_split_confidence: 'high'
  };
};
const classifyLegacyMarriageNote = (value) => {
  const v = upper(value);
  if (!v) return 'sin_clasificar';
  if (v.includes('NIHIL OBSTAT')) return 'nihil_obstat';
  if (v.includes('DISPARIDAD DE CULTO') || v.includes('MIXTA RELIGION')) return 'disparidad_mixta';
  if (
    v.includes('DECLARADO NULO')
    || v.includes('DECLARATORIA DE NULIDAD')
    || v.includes('SE ANULA ESTA PARTIDA')
    || v.includes('ANULACION DEL MATRIMONIO')
  ) return 'nulidad_referida';
  if (v.includes('CONFIRMACION') || v.includes('CONFIRMACIÓN')) return 'confirmacion_referida';
  if (v.includes('INCONSISTENCIAS') || v.includes('NO SE EXPIDE CERTIFICADO')) return 'restriccion_observacion';
  return 'otra';
};
const normalizeLegacyMarriageNote = (r) => ({
  book_number:text(r.libro),
  folio:text(r.folio),
  number:text(r.numero),
  content:text(r.nota),
  legacy_dafe_code:text(r.dafe),
  legacy_updated_at:text(r.actualizad),
  classification:classifyLegacyMarriageNote(r.nota)
});

export const LEGACY_IMPORT_PROFILES = {
  BAUTIZOS: {
    label: 'Bautismos históricos', targetEntity: 'baptism', requiresParish: true,
    normalize: (r) => ({
      book_number: text(r.libro), folio: text(r.folio), number: text(r.numero),
      celebration_date: dateOnly(r.fecbau), celebration_place: text(r.lugbau),
      last_names: text(r.apellidos), names: text(r.nombres), birth_date: dateOnly(r.fecnac),
      birth_place: text(r.lugarn || r.lugnac), gender: sex(r.sexo), parent_union_type: unionType(r.tipohijo),
      father_name: text(r.padre), father_document: text(r.cedupad), mother_name: text(r.madre), mother_document: text(r.cedumad),
      paternal_grandparents: text(r.abuepat), maternal_grandparents: text(r.abuemat), godparents: text(r.padrinos),
      address: text(r.direccion), minister: text(r.ministro), legacy_dafe_code: text(r.dafe),
      civil_registry_number: text(r.regciv || r.numinsc), nuip: text(r.nuip), civil_registry_office: text(r.notaria),
      civil_registry_date: dateOnly(r.fecregis), annulled: boolish(r.anulado),
      observations: text(r.observacio || r.observations), legacy_updated_at: text(r.actualizad),
      legacy_flags: { adulto: r.adulto ?? null, confirmacion: r.confirmaci ?? null, docu1: r.docu1 ?? null, docu2: r.docu2 ?? null, docu3: r.docu3 ?? null, docu4: r.docu4 ?? null }
    }),
    key: (r) => sourceKey(r.libro,r.folio,r.numero)
  },
  CONFIRMA: {
    label: 'Confirmaciones históricas', targetEntity: 'confirmation', requiresParish: true,
    normalize: (r) => ({
      book_number: text(r.libro), folio: text(r.folio), number: text(r.numero),
      celebration_date: dateOnly(r.feccon), celebration_place: text(r.lugcon), last_names: text(r.apellidos), names: text(r.nombres),
      birth_date: dateOnly(r.fecnac), age_text: text(r.edad), gender: sex(r.sexo), father_name: text(r.padre), mother_name: text(r.madre),
      sponsor: text(r.padri || r.padrinos), minister: text(r.ministro), legacy_dafe_code: text(r.dafe),
      baptism_church_code: text(r.codbau), baptism_place: text(r.lugbau), baptism_book: text(r.libbau), baptism_folio: text(r.folbau), baptism_number: text(r.numbau),
      annulled: boolish(r.anulado), legacy_updated_at: text(r.actualizad), observations: text(r.observacio || r.observations)
    }),
    key: (r) => sourceKey(r.libro,r.folio,r.numero)
  },
  MATRIMON: {
    label: 'Matrimonios históricos', targetEntity: 'marriage', requiresParish: true,
    normalize: (r) => ({
      book_number: text(r.libro), folio: text(r.folio), number: text(r.numero), legacy_entry_number: text(r.numinsc), celebration_date: dateOnly(r.fecmat),
      party_1: { last_names: text(r.apell1), names: text(r.nombr1), parents: text(r.hijode), baptism_place: text(r.lugbau1), baptism_date: dateOnly(r.fecbau1), baptism_book: text(r.libbau1), baptism_folio: text(r.folbau1), baptism_number: text(r.numbau1), birth_date: dateOnly(r.fecnac1), birth_place: text(r.lugnac1) },
      party_2: { last_names: text(r.apell2), names: text(r.nombr2), parents: text(r.hijade), baptism_place: text(r.lugbau2), baptism_date: dateOnly(r.fecbau2), baptism_book: text(r.libbau2), baptism_folio: text(r.folbau2), baptism_number: text(r.numbau2), birth_date: dateOnly(r.fecnac2), birth_place: text(r.lugnac2) },
      witnesses: text(r.testigos), minister: text(r.ministro), legacy_dafe_code: text(r.dafe), free_union: r.unilibre ?? null, annulled: boolish(r.anulado), legacy_updated_at: text(r.actualizad), observations: text(r.observacio || r.observations)
    }),
    key: (r) => sourceKey(r.libro,r.folio,r.numero)
  },
  DIFUNTOS: {
    label: 'Exequias históricas', targetEntity: 'funeral', requiresParish: true,
    normalize: (r) => ({
      book_number: text(r.libro), folio: text(r.folio), number: text(r.numero), names: text(r.nombres || r.nombre), last_names: text(r.apellidos), birth_date: dateOnly(r.fecnac), death_date: dateOnly(r.fecham || r.fecha_defuncion), death_place: text(r.lugmue || r.lugar_defuncion), funeral_date: dateOnly(r.fechae || r.fecha_exequias), funeral_place: text(r.lugexe || r.lugar_exequias), cemetery: text(r.cementerio), minister: text(r.ministro), legacy_dafe_code: text(r.dafe), observations: text(r.observacio || r.observations)
    }),
    key: (r) => sourceKey(r.libro,r.folio,r.numero)
  },
  INSBAUTI: {
    label: 'Preinscripciones históricas de Bautismo', targetEntity: 'pending_baptism', requiresParish: true,
    normalize: (r) => ({ legacy_entry_number:text(r.numero), inscription_date:safeLegacyDate(r.fecins), celebration_date:safeLegacyDate(r.fecbau), celebration_place:text(r.lugbau), last_names:text(r.apellidos), names:text(r.nombres), birth_date:safeLegacyDate(r.fecnac), birth_place:text(r.lugarn || r.lugnac), gender:sex(r.sexo), parent_union_type:unionType(r.tipohijo), father_name:text(r.padre), father_document:text(r.cedupad), mother_name:text(r.madre), mother_document:text(r.cedumad), paternal_grandparents:text(r.abuepat), maternal_grandparents:text(r.abuemat), godparents:text(r.padrinos), minister:text(r.ministro), decree_number:text(r.numdecreto), decree_date:safeLegacyDate(r.fecdecreto), decree_issuer:text(r.expdecreto), civil_registry_number:text(r.regciv), nuip:text(r.nuip), civil_registry_office:text(r.notaria), civil_registry_date:safeLegacyDate(r.fecregis), reported:boolish(r.reported) }),
    key: (r) => sourceKey(r.numero,r.fecins,r.apellidos,r.nombres)
  },
  INSCONFI: {
    label: 'Preinscripciones históricas de Confirmación', targetEntity: 'pending_confirmation', requiresParish: true,
    normalize: (r) => ({ legacy_entry_number:text(r.numero), inscription_date:safeLegacyDate(r.fecins), celebration_date:safeLegacyDate(r.feccon), celebration_place:text(r.lugcon), last_names:text(r.apellidos), names:text(r.nombres), birth_date:safeLegacyDate(r.fecnac), age_text:text(r.edad), gender:sex(r.sexo), baptism_church_code:text(r.codbau), baptism_place:text(r.lugbau), baptism_book:text(r.libbau), baptism_folio:text(r.folbau), baptism_number:text(r.numbau), father_name:text(r.padre), mother_name:text(r.madre), sponsor:text(r.padri), minister:text(r.ministro), reported:boolish(r.reported) }),
    key: (r) => sourceKey(r.numero,r.fecins,r.apellidos,r.nombres)
  },
  INSMATRI: {
    label: 'Inscripciones de Matrimonio', targetEntity: 'pending_marriage', requiresParish: true,
    normalize: (r) => ({ ...r, reported:boolish(r.reported) }), key: (r) => sourceKey(r.numero,r.fecins,r.apell1,r.nombr1,r.apell2,r.nombr2)
  },
  ANULACION: {
    label: 'Correcciones / anulaciones históricas', targetEntity: 'decree_link', requiresParish: true,
    normalize: (r) => {
      const code = text(r.codiconcep);
      const sacrament_type = code === '003' ? 'matrimonio' : code === '004' ? 'confirmacion' : 'bautismo';
      return { original_book:text(r.libro), original_folio:text(r.folio), original_number:text(r.numero), decree_number:text(r.decreto), concept_code:code, decree_date:dateOnly(r.fecha), new_book:text(r.newlib), new_folio:text(r.newfol), new_number:text(r.newnum), observations:text(r.observacio), legacy_dafe_code:text(r.dafe), type:r.tipo ?? null, legacy_created_at:text(r.fechanul || r.actualizad), legacy_user:text(r.usuario), sacrament_type };
    },
    key: (r) => sourceKey(r.libro,r.folio,r.numero,r.decreto)
  },
  CPTOANULA: {
    label: 'Conceptos de corrección/anulación', targetEntity: 'annulment_concept', requiresParish: true,
    normalize: (r) => ({ code:text(r.codigo), concept:text(r.concepto), registers:boolish(r.seinscribe), generates_note:boolish(r.gennota), generates_document:boolish(r.gendocum), book_mode:Number(r.enlibro || 0), issuer:text(r.expide), type: upper(r.concepto).includes('MATRIMON') ? 'matrimonio' : upper(r.concepto).includes('CONFIR') ? 'confirmacion' : upper(r.concepto).includes('BAUT') ? 'bautismo' : 'general' }),
    key: (r) => text(r.codigo)
  },
  CERTIFICADOS: {
    label: 'Plantillas documentales', targetEntity: 'document_template', requiresParish: true,
    normalize: (r) => ({ legacy_code:cleanCode(r.codigo), code:`LEGACY-${cleanCode(r.codigo)}`, name:text(r.descripcio), category: (()=>{ const n=upper(r.descripcio); if(n.includes('DISPENSA')) return 'dispensation'; if(n.includes('SOLICITUD')) return 'request'; if(n.includes('CORRECCI')) return 'correction_request'; if(n.includes('REPOSICI')) return 'replacement_request'; if(n.includes('CERTIFIC')) return 'certificate'; if(n.includes('PERMISO')||n.includes('LICENCIA')) return 'permission'; return 'legacy_document'; })(), template_text:text(r.plantilla) }),
    key: (r) => cleanCode(r.codigo)
  },
  CIUDADES: {
    label: 'Diccionario histórico de lugares', targetEntity: 'location_dictionary', requiresParish: true,
    normalize: (r) => ({ source:text(r.source), value:text(r.data || r.nombre), usage_count:Number(r.count || 0), weight:Number(r.weight || 0), source_created_at:text(r.created), source_updated_at:text(r.updated), source_user:text(r.user) }),
    key: (r) => sourceKey(r.source,r.data || r.nombre)
  },
  DIOCESIS: {
    label: 'Directorio histórico de diócesis', targetEntity: 'directory_diocese', requiresParish: true,
    normalize: (r) => ({ legacy_code:text(r.codigo), name:text(r.nombre), nit:text(r.nronit), address:text(r.direccion), phone:text(r.telefono), fax:text(r.nrofax), email:text(r.email), city:text(r.ciudad), bishop_1:text(r.obispo_1), bishop_2:text(r.obispo_2) }),
    key: (r) => sourceKey(r.codigo,r.nombre)
  },
  IGLESIAS: {
    label: 'Directorio histórico de iglesias', targetEntity: 'directory_church', requiresParish: true,
    normalize: (r) => ({ legacy_code:text(r.codigo), name:text(r.nombre), nit:text(r.nronit), address:text(r.direccion), city:text(r.ciudad), phone:text(r.telefono), fax:text(r.nrofax), email:text(r.email), priest_name:text(r.parroco), diocese_legacy_code:text(r.diocesis) }),
    key: (r) => sourceKey(r.codigo,r.nombre)
  },
  PARROCOS: {
    label:'Directorio histórico de párrocos', targetEntity:'legacy_priest_directory', requiresParish: true,
    normalize:(r)=>({
      legacy_code:text(r.codigo),
      ...splitLegacyPriestName(r.nombre),
      service_start:dateOnly(r.fecing),
      service_end:dateOnly(r.fecsal),
      legacy_state:r.estado ?? null,
      legacy_grade:text(r.grado)
    }),
    key:(r)=>text(r.codigo)
  },
  OBISPOS: { label:'Directorio histórico de obispos', targetEntity:'legacy_reference_catalog', requiresParish: true, normalize:(r)=>({...r}), key:(r,i)=>sourceKey(r.codigo || r.id || r.nombre || 'OBISPO',i) },
  MISDATOS: { label:'Configuración de instalación antigua', targetEntity:'legacy_settings', requiresParish: true, normalize:(r)=>({...r}), key:(r)=>text(r.idcod || r.nombre) },
  DATOSHIJOS: { label:'Datos hijos legacy', targetEntity:'legacy_settings', requiresParish: true, normalize:(r)=>({...r}), key:(r,i)=>sourceKey('DATOSHIJOS',i) },
  IMPRESAS: { label:'Histórico de impresiones legacy', targetEntity:'legacy_settings', requiresParish: true, normalize:(r)=>({...r}), key:(r,i)=>sourceKey('IMPRESAS',i) },
  NTBAU001: { label:'Notas marginales Bautismo lote 1', targetEntity:'legacy_marginal_note', requiresParish:true, normalize:(r)=>({...r}), key:(r,i)=>sourceKey(r.libro,r.folio,r.numero,i) },
  NTBAU002: { label:'Notas marginales Bautismo lote 2', targetEntity:'legacy_marginal_note', requiresParish:true, normalize:(r)=>({...r}), key:(r,i)=>sourceKey(r.libro,r.folio,r.numero,i) },
  NTMAT001: { label:'Notas históricas de Matrimonio lote 1', targetEntity:'legacy_marginal_note', requiresParish:true, normalize:normalizeLegacyMarriageNote, key:(r,i)=>sourceKey(r.libro,r.folio,r.numero,r.actualizad || r.dafe,i) },
  NTMAT002: { label:'Notas históricas de Matrimonio lote 2', targetEntity:'legacy_marginal_note', requiresParish:true, normalize:normalizeLegacyMarriageNote, key:(r,i)=>sourceKey(r.libro,r.folio,r.numero,r.actualizad || r.dafe,i) }
};

export const normalizeLegacyFilename = (filename='') => upper(filename).replace(/\.JSON$/i,'').replace(/\s*\(\d+\)\s*$/,'').replace(/[^A-Z0-9_]/g,'');

export const detectLegacyProfile = (filename, rows=[]) => {
  const byName = normalizeLegacyFilename(filename);
  if (LEGACY_IMPORT_PROFILES[byName]) return byName;
  const sample = rows.find(Boolean) || {};
  const keys = new Set(Object.keys(sample).map(k=>k.toLowerCase()));
  if (keys.has('fecbau') && keys.has('libro') && keys.has('folio')) return 'BAUTIZOS';
  if (keys.has('feccon') && keys.has('lugcon') && keys.has('libro')) return 'CONFIRMA';
  if (keys.has('fecmat') && keys.has('apell1') && keys.has('apell2')) return 'MATRIMON';
  if (keys.has('nota') && keys.has('libro') && keys.has('folio') && keys.has('numero') && keys.has('dafe') && !keys.has('fecmat')) return 'NTMAT002';
  if (keys.has('decreto') && keys.has('newlib') && keys.has('codiconcep')) return 'ANULACION';
  if (keys.has('plantilla') && keys.has('descripcio')) return 'CERTIFICADOS';
  if (keys.has('source') && keys.has('data') && keys.has('weight')) return 'CIUDADES';
  if (keys.has('fecing') && keys.has('fecsal') && keys.has('codigo') && keys.has('nombre')) return 'PARROCOS';
  if (keys.has('obispo_1') && keys.has('codigo')) return 'DIOCESIS';
  if (keys.has('parroco') && keys.has('diocesis') && keys.has('codigo')) return 'IGLESIAS';
  return null;
};

export const extractLegacyRows = (json) => Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);

const dateIssue = (value, label) => {
  if (!value) return null;
  const v = dateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { code:'INVALID_DATE_FORMAT', detail:`${label}: ${value}` };
  const year = Number(v.slice(0,4));
  const nowYear = new Date().getFullYear();
  if (year < 1800 || year > nowYear + 1) return { code:'SUSPICIOUS_DATE', detail:`${label}: ${value}` };
  const d = new Date(`${v}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { code:'INVALID_DATE', detail:`${label}: ${value}` };
  return null;
};

export const analyzeLegacyRow = (profileKey, raw, index=0) => {
  const profile = LEGACY_IMPORT_PROFILES[profileKey];
  if (!profile) throw new Error(`Perfil no soportado: ${profileKey}`);
  const normalized = profile.normalize(raw,index);
  const issues = [];
  const add = (code,detail) => issues.push({code,detail});

  if (profile.requiresParish && ['baptism','confirmation','marriage','funeral'].includes(profile.targetEntity)) {
    if (!text(normalized.book_number)) add('MISSING_BOOK','Falta Libro');
    if (!text(normalized.folio)) add('MISSING_FOLIO','Falta Folio');
    if (!text(normalized.number)) add('MISSING_NUMBER','Falta Número');
  }
  if (profile.targetEntity==='marriage' && !text(normalized.book_number)) add('MISSING_BOOK_REVIEW','Matrimonio histórico sin Libro; requiere revisión física');
  if (['pending_baptism','pending_confirmation'].includes(profile.targetEntity)) {
    if (normalized.reported === true) add('LEGACY_BOLETA_REPORTED','Boleta histórica reportada: debe conservarse y conciliarse contra una partida celebrada');
    else add('LEGACY_BOLETA_NOT_SEATED','Boleta histórica no sentada: debe conservarse completa sin crear una partida automáticamente');
  } else if (['pending_marriage'].includes(profile.targetEntity) && normalized.reported === true) {
    add('REPORTED_LEGACY_RECORD','El sistema antiguo lo marca como reportado; debe reconciliarse antes de crear un pendiente nuevo');
  }

  const dateFields = [
    ['celebration_date','Fecha sacramento'],['birth_date','Fecha nacimiento'],['civil_registry_date','Fecha registro civil'],
    ['baptism_date','Fecha bautismo'],['death_date','Fecha defunción'],['funeral_date','Fecha exequias'],['decree_date','Fecha decreto']
  ];
  dateFields.forEach(([key,label])=>{ const i=dateIssue(normalized[key],label); if(i) add(i.code,i.detail); });
  if (profile.targetEntity==='marriage') {
    [['party_1','Contrayente 1'],['party_2','Contrayente 2']].forEach(([k,label])=>{
      const p=normalized[k]||{};
      const i1=dateIssue(p.birth_date,`${label} nacimiento`); if(i1) add(i1.code,i1.detail);
      const i2=dateIssue(p.baptism_date,`${label} bautismo`); if(i2) add(i2.code,i2.detail);
      if (p.birth_date && p.baptism_date && /^\d{4}/.test(p.birth_date) && /^\d{4}/.test(p.baptism_date) && p.birth_date > p.baptism_date) add('BIRTH_AFTER_BAPTISM',`${label}: nacimiento posterior al bautismo`);
    });
  }

  if (profile.targetEntity==='legacy_marginal_note') {
    if (!text(normalized.book_number)) add('MISSING_BOOK','Nota histórica sin Libro');
    if (!text(normalized.folio)) add('MISSING_FOLIO','Nota histórica sin Folio');
    if (!text(normalized.number)) add('MISSING_NUMBER','Nota histórica sin Número');
    if (!text(normalized.content)) add('MISSING_NOTE_CONTENT','Nota histórica sin contenido');
  }
  if (profile.targetEntity==='decree_link' && (!text(normalized.original_book) || !text(normalized.original_folio) || !text(normalized.original_number))) add('MISSING_ORIGINAL_REFERENCE','No se puede localizar la partida original');
  if (profile.targetEntity==='directory_diocese' && !text(normalized.name)) add('MISSING_NAME','Directorio diocesano sin nombre');
  if (profile.targetEntity==='directory_church' && !text(normalized.name)) add('MISSING_NAME','Directorio de iglesia sin nombre');
  if (profile.targetEntity==='location_dictionary' && !text(normalized.value)) add('MISSING_VALUE','Lugar vacío');
  if (profile.targetEntity==='document_template' && !text(normalized.template_text)) add('MISSING_TEMPLATE','Plantilla documental vacía');

  const hardReview = issues.some(i => ['SUSPICIOUS_DATE','INVALID_DATE','INVALID_DATE_FORMAT','MISSING_BOOK_REVIEW','REPORTED_LEGACY_RECORD','MISSING_ORIGINAL_REFERENCE'].includes(i.code));
  const requiredMissing = issues.some(i => ['MISSING_BOOK','MISSING_FOLIO','MISSING_NUMBER','MISSING_NAME','MISSING_VALUE','MISSING_TEMPLATE','MISSING_NOTE_CONTENT'].includes(i.code));
  const preserveAllBoletas = ['pending_baptism','pending_confirmation'].includes(profile.targetEntity);
  const queueableLegacyNote = profile.targetEntity === 'legacy_marginal_note' && !requiredMissing;
  const status = preserveAllBoletas || queueableLegacyNote
    ? 'valid'
    : (hardReview || requiredMissing || ['pending_marriage','legacy_settings'].includes(profile.targetEntity) ? 'review' : 'valid');
  return {
    row_number:index+1,
    source_key:profile.key(raw,index) || String(index+1),
    target_entity:profile.targetEntity,
    original_data:raw,
    normalized_data:normalized,
    status,
    issue_codes:[...new Set(issues.map(i=>i.code))],
    issue_details:{issues}
  };
};

export const profileOptions = Object.entries(LEGACY_IMPORT_PROFILES).map(([key,p])=>({key,label:p.label,targetEntity:p.targetEntity,requiresParish:p.requiresParish}));
