/**
 * V254: RUTAS REGISTRALES. Regla de selección previa a cualquier RPC.
 * No considera "celebración ya realizada" suficiente para clasificar como histórica:
 * una celebración nueva puede estar pendiente de asiento, mientras una partida
 * histórica YA EXISTE con libro / folio / número de su fuente.
 *
 * Esta política es una defensa de presentación; el servidor debe comprobar
 * identidad, jurisdicción, fuente histórica y unicidad por su cuenta.
 */
const LOCATOR_KEYS = Object.freeze({
  book:['Libro','libro','book_number'],
  folio:['folio','page_number'],
  number:['numero','number','entry_number']
});
const normalizedText=x=>String(x??'').trim();
export function historicalCoordinates(record){
  if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Partida histórica incompleta.');
  const result={};
  for(const [part,keys] of Object.entries(LOCATOR_KEYS)){
    const specified=keys.filter(key=>record[key]!==null&&record[key]!==undefined&&normalizedText(record[key])!=='')
      .map(key=>normalizedText(record[key]));
    if(!specified.length)throw Error('Una partida histórica debe conservar Libro, Folio y Número originales.');
    if(new Set(specified).size>1)throw Error('Coordenadas contradictorias para '+part+'.');
    result[part]=specified[0];
  }
  return Object.freeze(result);
}
export const ENTRY_PATH=Object.freeze({
  NEW_SACRAMENT:'new_sacrament',
  HISTORICAL_DIRECT:'historical_direct',
  HISTORICAL_IMPORT:'historical_import',
  NEW_DECREE_SUPPLEMENT:'new_decree_supplement',
  NEW_DECREE_EXISTING:'new_decree_existing',
  HISTORICAL_DECREE:'historical_decree'
});
const id=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export function resolveRegistryJourney({path,record={},verified=false,linkedRecordIds=[],decreeEffect=null}={}){
  if(!Object.values(ENTRY_PATH).includes(path))throw Error('No se puede determinar la procedencia registral; requiere revisión.');
  const existing=Array.isArray(linkedRecordIds)?[...new Set(linkedRecordIds.filter(id))]:[];
  if([ENTRY_PATH.NEW_SACRAMENT,ENTRY_PATH.NEW_DECREE_SUPPLEMENT].includes(path)){
    if(!verified)throw Error('La celebración o actuación nueva no está verificada.');
    if(existing.length)throw Error('Ya existe una partida: no se asignará otro consecutivo.');
    if(path===ENTRY_PATH.NEW_DECREE_SUPPLEMENT&&decreeEffect!=='create_supplementary_record')
      throw Error('El decreto nuevo no exige una partida supletoria.');
    const hasAnyPhysical=Object.values(LOCATOR_KEYS).some(keys=>keys.some(key=>normalizedText(record?.[key])));
    if(hasAnyPhysical)throw Error('La partida nueva no puede llegar con Libro, Folio o Número previamente asignados.');
    return Object.freeze({path,action:'seat_new',consumeMemory:true,preservePhysicalCoordinates:false});
  }
  if(path===ENTRY_PATH.HISTORICAL_DIRECT||path===ENTRY_PATH.HISTORICAL_IMPORT){
    const coordinates=historicalCoordinates(record);
    return Object.freeze({path,action:'preserve_historical',consumeMemory:false,
      preservePhysicalCoordinates:true,coordinates});
  }
  if(path===ENTRY_PATH.NEW_DECREE_EXISTING||path===ENTRY_PATH.HISTORICAL_DECREE){
    if(existing.length!==1) return Object.freeze({path,action:'review_required',consumeMemory:false,reason:'existing_record_not_unique'});
    if(path===ENTRY_PATH.HISTORICAL_DECREE) {
      const coordinates=historicalCoordinates(record);
      return Object.freeze({path,action:'link_existing_decree',consumeMemory:false,
        preservePhysicalCoordinates:true,recordId:existing[0],coordinates});
    }
    return Object.freeze({path,action:'act_on_existing_decree',consumeMemory:false,
      preservePhysicalCoordinates:true,recordId:existing[0]});
  }
  throw Error('Operación registral no contemplada.');
}
/** Legacy decree import: requires a matched, already recorded original and, if supplied,
 * one matched replacement; NEVER creates records or reserves book memory.
 */
export function validateHistoricalDecreeAssociation({originalCoordinates,replacementCoordinates,
  originalMatches=[],replacementMatches=[]}={}){
  const old=historicalCoordinates(originalCoordinates);
  const replacementsPresent=replacementCoordinates!==null&&replacementCoordinates!==undefined;
  const next=replacementsPresent?historicalCoordinates(replacementCoordinates):null;
  if(!Array.isArray(originalMatches)||originalMatches.length!==1||!id(originalMatches[0]))
    return Object.freeze({action:'review_required',reason:'original_match_not_unique',consumeMemory:false});
  if(next&&(!Array.isArray(replacementMatches)||replacementMatches.length!==1||!id(replacementMatches[0])))
    return Object.freeze({action:'review_required',reason:'replacement_match_not_unique',consumeMemory:false});
  if(next&&originalMatches[0]===replacementMatches[0])
    return Object.freeze({action:'review_required',reason:'original_equals_replacement',consumeMemory:false});
  return Object.freeze({action:'link_existing_decree',consumeMemory:false,
    originalRecordId:originalMatches[0],replacementRecordId:next?replacementMatches[0]:null,
    originalCoordinates:old,replacementCoordinates:next});
}
