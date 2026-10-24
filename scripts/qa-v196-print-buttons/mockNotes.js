export const listMarginalNotesForRecord=async()=>[];
export const getInitialPrintSelection=()=>[];
export const composePrintableNotes=()=>[];
export const registerRegistryPrint=async payload=>{
  if(!window.__qa196)throw Error('QA harness missing');
  const a=window.__qa196;
  a.registerCalls.push({kind:payload.sacramentType,book:payload.expectedCoordinates?.book,folio:payload.expectedCoordinates?.folio,
   number:payload.expectedCoordinates?.number,hasHtml:!!payload.htmlSnapshot,status:payload.expectedStatus,
   recordUpdated:!!payload.expectedRecordUpdatedAt});
  if(a.deny)throw Error('QA V196 rechazo simulado de constancia de auditoría');
  return {id:'qa-audited'};
};