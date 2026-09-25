import { supabase } from '@/lib/supabaseClient';
import { getLocalDateISO } from '@/utils/localDate';

const replaceAll = (text, variables={}) => Object.entries(variables).reduce((acc,[key,value]) => {
  const safe = value == null || value === '' ? '---' : String(value);
  return acc.replace(new RegExp(`\\[${key}\\]`,'g'),safe);
}, String(text || ''));

export const PRINT_POLICIES = Object.freeze({ REQUIRED:'required', OPTIONAL:'optional', INTERNAL:'internal' });

export async function getResolvedMarginalTemplates({ sacramentType='any', dioceseId=null, parishId=null }={}) {
  const { data, error } = await supabase
    .from('marginal_note_templates')
    .select('*, marginal_note_template_clauses(*)')
    .eq('is_active',true)
    .in('sacrament_type',['any',sacramentType])
    .order('version',{ascending:false});
  if (error) throw error;

  const score = (t) => t.scope_type==='parish' && parishId && t.parish_id===parishId ? 30
    : t.scope_type==='diocese' && dioceseId && t.diocese_id===dioceseId ? 20
      : t.scope_type==='system' ? 10 : -1;
  const chosen = new Map();
  (data||[]).forEach(t => {
    const s=score(t); if(s<0) return;
    const current=chosen.get(t.code);
    if(!current || s>current.__score || (s===current.__score && Number(t.version)>Number(current.version))) chosen.set(t.code,{...t,__score:s});
  });
  return [...chosen.values()].map(({__score,...t})=>({
    ...t,
    marginal_note_template_clauses:(t.marginal_note_template_clauses||[]).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))
  }));
}

export function renderMarginalTemplate(template, variables={}, selectedClauseCodes=[]) {
  if (!template) return { text:'', clauses:[] };
  const clauses=(template.marginal_note_template_clauses||[]).filter(c=>c.is_required || selectedClauseCodes.includes(c.code) || c.enabled_by_default && selectedClauseCodes.length===0);
  const before=clauses.filter(c=>c.placement==='before').map(c=>c.clause_text);
  const after=clauses.filter(c=>c.placement!=='before').map(c=>c.clause_text);
  const parts=[...before,template.base_text,...after].filter(Boolean);
  return {
    text:replaceAll(parts.join(' '),variables).replace(/\s+/g,' ').trim(),
    clauses:clauses.map(c=>({id:c.id,code:c.code,label:c.label,text:replaceAll(c.clause_text,variables),placement:c.placement}))
  };
}

export async function listMarginalNotesForRecord({ parishId, sacramentType, sacramentId, legacyInlineNote='' }) {
  if (!sacramentId) return legacyInlineNote ? [{id:'legacy-inline',content:String(legacyInlineNote),note_type:'legacy_inline',print_policy:'optional',print_default:true,is_locked:false,print_label:'Nota histórica del registro',status:'active',isLegacyInline:true}] : [];
  const { data, error } = await supabase
    .from('marginal_notes')
    .select('*')
    .eq('parish_id',parishId)
    .eq('sacrament_type',sacramentType)
    .eq('sacrament_id',sacramentId)
    .order('sort_order',{ascending:true})
    .order('note_date',{ascending:true})
    .order('created_at',{ascending:true});
  if (error) throw error;

  const allNotes=[...(data||[])];
  const inactiveStatuses=new Set(['reversed','revertida','deleted']);
  const notes=allNotes.filter(n=>!inactiveStatuses.has(String(n.status||'').trim().toLowerCase()));
  const cleanInline=String(legacyInlineNote || '').trim();
  const inlineWasReversed=Boolean(cleanInline) && allNotes.some(n=>
    inactiveStatuses.has(String(n.status||'').trim().toLowerCase()) &&
    String(n.content||'').trim()===cleanInline
  );
  if(cleanInline && !inlineWasReversed && !notes.some(n=>String(n.content||'').trim()===cleanInline)) {
    notes.unshift({id:'legacy-inline',content:cleanInline,note_type:'legacy_inline',print_policy:'optional',print_default:true,is_locked:false,print_label:'Nota histórica del registro',status:'active',isLegacyInline:true});
  }
  return notes;
}

export function getInitialPrintSelection(notes=[]) {
  return notes.filter(n=>n.print_policy==='required' || (n.print_policy==='optional' && n.print_default!==false)).map(n=>n.id);
}

export function composePrintableNotes(notes=[],selectedIds=[]) {
  return notes.filter(n=>n.print_policy!=='internal' && (n.print_policy==='required' || selectedIds.includes(n.id))).map(n=>String(n.content||'').trim()).filter(Boolean);
}

export async function createManualMarginalNote({ parishId,sacramentType,sacramentId,content,noteDate,printPolicy='optional',printDefault=true,label=null,templateId=null,variables={},clauses=[] }) {
  const { data,error }=await supabase.rpc('create_manual_marginal_note',{
    p_parish_id:parishId,
    p_sacrament_type:sacramentType,
    p_sacrament_id:sacramentId,
    p_content:content,
    p_note_date:noteDate || getLocalDateISO(),
    p_print_policy:printPolicy,
    p_print_default:printDefault,
    p_label:label,
    p_template_id:templateId,
    p_variables:variables,
    p_clause_snapshot:clauses
  });
  if(error) throw error;
  return data;
}

export async function listDocumentTemplates({category=null}={}) {
  let q=supabase.from('document_templates').select('*').eq('is_active',true).order('category').order('name');
  if(category) q=q.eq('category',category);
  const {data,error}=await q; if(error) throw error; return data||[];
}

export async function saveMarginalTemplateVersion({
  code,name,sacramentType='any',eventType='manual',baseText,printPolicy='optional',printDefault=true,
  isFixed=true,allowsClauses=true,scopeType='diocese',dioceseId=null,parishId=null,clauses=[],metadata={}
}) {
  const {data,error}=await supabase.rpc('save_marginal_note_template',{
    p_code:code,
    p_name:name,
    p_sacrament_type:sacramentType,
    p_event_type:eventType,
    p_base_text:baseText,
    p_print_policy:printPolicy,
    p_print_default:printDefault,
    p_is_fixed:isFixed,
    p_allows_clauses:allowsClauses,
    p_scope_type:scopeType,
    p_diocese_id:dioceseId,
    p_parish_id:parishId,
    p_clauses:clauses,
    p_metadata:metadata
  });
  if(error) throw error;
  return data;
}

export async function registerRegistryPrint({ parishId, sacramentType, sacramentId, documentKind='partida', selectedNoteKeys=[], includedNotes=[], metadata={} }) {
  if (!parishId || !sacramentId) return null;
  const { data, error } = await supabase.rpc('register_registry_print', {
    p_parish_id: parishId,
    p_sacrament_type: sacramentType,
    p_sacrament_id: sacramentId,
    p_document_kind: documentKind,
    p_selected_note_keys: (selectedNoteKeys || []).map(String),
    p_included_notes: includedNotes,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data;
}

export async function saveDocumentTemplateVersion({ code, name, category='document', templateText, scopeType='diocese', dioceseId=null, parishId=null, metadata={} }) {
  const { data, error } = await supabase.rpc('save_document_template', {
    p_code: code,
    p_name: name,
    p_category: category,
    p_template_text: templateText,
    p_scope_type: scopeType,
    p_diocese_id: dioceseId,
    p_parish_id: parishId,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data;
}
