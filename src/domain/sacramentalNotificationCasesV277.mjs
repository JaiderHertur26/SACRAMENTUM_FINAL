// V277 — Matriz institucional de destinos de Bautismo.
// Sin acceso a datos ni asignación de Libro/Folio/Número. Se usa en UI y QA.
export const DESTINATION = Object.freeze({
  LOCAL_DIGITAL: 'local_digital',
  LOCAL_PHYSICAL: 'local_physical',
  SYSTEM_DIGITAL: 'system_digital',
  SYSTEM_PHYSICAL: 'system_physical',
  EXTERNAL: 'external'
});
export const CASE_STATUS = Object.freeze({
  COMPLETED: 'completed',
  WAITING_PARISH: 'waiting_parish',
  WAITING_PHYSICAL: 'waiting_physical',
  WAITING_EXTERNAL: 'waiting_external',
  PARTIAL: 'partial'
});
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const completeCoordinates = x => Boolean(nonempty(String(x?.book ?? '')) && nonempty(String(x?.folio ?? '')) && nonempty(String(x?.number ?? '')));
const validId = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

export function classifyBaptismDestination({senderParishId,parishId=null,baptismId=null,externalParishName='',externalDioceseName=''}={}) {
  if (!validId(senderParishId)) throw new Error('Parroquia emisora inválida');
  if (baptismId && !validId(baptismId)) throw new Error('Partida digital inválida');
  if (parishId && !validId(parishId)) throw new Error('Parroquia destinataria inválida');
  if (!parishId) {
    if (!nonempty(externalParishName) || !nonempty(externalDioceseName)) {
      throw new Error('Indique la parroquia y diócesis externas');
    }
    if (baptismId) throw new Error('Una partida digital requiere parroquia interna');
    return DESTINATION.EXTERNAL;
  }
  if (nonempty(externalParishName) || nonempty(externalDioceseName)) {
    throw new Error('Un destino interno no puede contener otra parroquia externa');
  }
  if (parishId === senderParishId) {
    return baptismId ? DESTINATION.LOCAL_DIGITAL : DESTINATION.LOCAL_PHYSICAL;
  }
  return baptismId ? DESTINATION.SYSTEM_DIGITAL : DESTINATION.SYSTEM_PHYSICAL;
}

export function validateSacramentalCase({sacrament, senderParishId, parties}={}) {
  if (!['matrimonio','confirmacion'].includes(sacrament)) throw new Error('Sacramento no admitido');
  if (!Array.isArray(parties) || parties.length !== (sacrament === 'matrimonio' ? 2 : 1)) {
    throw new Error('Matrimonio exige dos personas y Confirmación una');
  }
  const roles = sacrament === 'matrimonio' ? ['principal','conyuge'] : ['confirmando'];
  const results = parties.map((party,index)=>{
    if (!party || party.role !== roles[index] || !nonempty(party.name) || party.name.trim().length < 4) {
      throw new Error('Identidad o función del bautizado incompleta');
    }
    const type = classifyBaptismDestination({...party,senderParishId});
    if ((type===DESTINATION.LOCAL_PHYSICAL || type===DESTINATION.SYSTEM_PHYSICAL)
        && !completeCoordinates(party.locator)) {
      // Sin coordenadas NO se puede afirmar que la partida física fue identificada.
      // Sí puede tramitarse solicitud de búsqueda sin certificar un asiento.
      if (!nonempty(party.searchReference) || party.searchReference.trim().length < 8) {
        throw new Error('Sin partida digital: anote coordenadas o referencia de búsqueda verificable');
      }
    }
    if(type===DESTINATION.EXTERNAL && !nonempty(party.deliveryReference)) {
      throw new Error('Debe registrar el medio previsto de envío a parroquia externa');
    }
    return {...party,type,requiresAcknowledgement:type!==DESTINATION.LOCAL_DIGITAL,
      requiresExternalEvidence:type===DESTINATION.EXTERNAL,
      manualCoordinatesVerified:completeCoordinates(party.locator)};
  });
  const ids=results.map(x=>x.baptismId).filter(Boolean);
  if(new Set(ids).size!==ids.length) throw new Error('Los contrayentes no pueden compartir partida bautismal');
  return results;
}

export function summarizeSacramentalCase(parties) {
  const items=Array.isArray(parties)?parties:[];
  if(!items.length) return {status:CASE_STATUS.WAITING_PARISH,complete:false,readyToPrint:false,pending:0};
  const state=items.map(p=>{
    const processed=p.status==='processed' || p.status==='completed';
    if (p.type===DESTINATION.EXTERNAL) {
      return processed && Boolean(p.returnEvidenceVerified) ? 'done':'external';
    }
    if(p.type===DESTINATION.LOCAL_DIGITAL) return p.noteApplied === true ? 'done':'parish';
    if (processed && (p.noteApplied===true || p.physicalNoteCertified===true)) return 'done';
    return p.type===DESTINATION.LOCAL_PHYSICAL || p.type===DESTINATION.SYSTEM_PHYSICAL ? 'physical':'parish';
  });
  const done=state.filter(x=>x==='done').length;
  const pending=items.length-done;
  const complete=pending===0;
  let status=CASE_STATUS.COMPLETED;
  if(!complete) status=done>0?CASE_STATUS.PARTIAL:
    state.includes('external')?CASE_STATUS.WAITING_EXTERNAL:
    state.includes('physical')?CASE_STATUS.WAITING_PHYSICAL:CASE_STATUS.WAITING_PARISH;
  return {status,complete,readyToPrint:complete,pending,completed:done,total:items.length};
}

export function notificationCaseLabel(type) {
  return ({
    local_digital:'Bautismo digital en la parroquia emisora',
    local_physical:'Bautismo local en libro físico, aún no digitalizado',
    system_digital:'Bautismo digital en otra parroquia de SACRAMENTUM',
    system_physical:'Otra parroquia en SACRAMENTUM; partida por identificar',
    external:'Parroquia fuera de SACRAMENTUM; devolución por vía externa'
  })[type] || 'Destino pendiente de clasificar';
}
