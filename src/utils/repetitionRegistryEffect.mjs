// El registro histórico se preserva, pero una nota de Repetición vigente
// impide presentar el asiento como partida acreditativa ordinaria.
export function hasActiveRepetitionWithoutEffect(notes=[]) {
  return Array.isArray(notes)&&notes.some(note=>{
    if(String(note?.note_type||'').toLowerCase()!=='decree_repetition')return false;
    if(['reversed','revertida','deleted','cancelled','anulada'].includes(String(note?.status||'active').toLowerCase()))return false;
    if(['reversed','revertida','cancelled','anulada','annulled'].includes(String(note?.linked_decree?.status||'active').toLowerCase()))return false;
    return true;
  });
}
