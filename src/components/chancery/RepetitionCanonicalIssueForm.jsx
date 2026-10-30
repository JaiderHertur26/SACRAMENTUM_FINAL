import React, { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import DecreeConceptEffects from '@/components/chancery/DecreeConceptEffects';
import {
  CanonicalParishSelector,
  CanonicalField,
  CanonicalSectionTitle,
  CanonicalMasterPanel,
  CanonicalEmptyPanel,
  CanonicalDetailPanel,
  CanonicalDetailHeader,
  CanonicalDecreeMetaGrid,
  CanonicalDetailBody,
  CanonicalReasonPanel,
  CanonicalNotice,
  CanonicalActionFooter,
  canonicalInputClass,
  canonicalSelectClass,
  canonicalTextareaClass
} from '@/components/chancery/CanonicalDecreePrimitives';
import { SACRAMENTS } from '@/utils/repetitionDecreePolicy.mjs';
import RepetitionDuplicateEntriesForm from '@/components/chancery/RepetitionDuplicateEntriesForm';
import { validateAffectedEntries } from '@/utils/repetitionCaseV314.mjs';

/**
 * El mismo sistema de captura usado por Corrección y Reposición.
 * Repetición no tiene asiento supletorio: únicamente actuación documental.
 */
export default function RepetitionCanonicalIssueForm({
  form, setForm, parishes = [], concepts = [], signers = {},
  busy = false, loading = false, onSubmit
}) {
  const [parishQuery,setParishQuery] = useState('');
  const set = (key,value) => setForm(prev=>({...prev,[key]:value}));
  const parish = parishes.find(p=>p.id===form.parishId);
  const eligibleConcepts = concepts.filter(c=>
    c.sacrament_type==='general'||c.sacrament_type===form.sacrament
  );
  const selectedConcept = eligibleConcepts.find(c=>c.id===form.conceptId)||null;
  const signerValid=form.signer==='canciller'?signers.canciller:signers.viceCanciller;
  let caseInvalid=false;
  if(form.caseMode==='duplicate_baptism_entries'){
    try { validateAffectedEntries(form.affectedEntries,form.parishId); }
    catch { caseInvalid=true; }
  }
  const remaining=(!parish||!form.conceptId||!form.number||!form.date||!form.target
    ||!form.reason||!form.evidence||!form.instruction||!signerValid||caseInvalid);

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
      <CanonicalMasterPanel
        kicker="01 · Parroquia principal"
        footer={
          <div className="border-t border-blue-100 bg-blue-50/60 p-4 text-[10px] leading-relaxed text-blue-900">
            En duplicidades, el mismo decreto se notificará a todas las parroquias afectadas que estén operativas.
            Nunca se eliminan los datos históricos ni se crean partidas automáticamente.
          </div>
        }>
        <CanonicalParishSelector
          parishes={parishes}
          value={form.parishId}
          query={parishQuery}
          onQueryChange={setParishQuery}
          onChange={id=>set('parishId',id)}
          loading={loading}
          label="Parroquia destinataria"
        />
      </CanonicalMasterPanel>

      {!parish ? (
        <CanonicalEmptyPanel
          title="Seleccione la parroquia de destino"
          text="Identifique primero la parroquia para preparar el expediente documental de Repetición."
        />
      ) : (
        <CanonicalDetailPanel>
          <CanonicalDetailHeader
            title={parish.name}
            subtitle={`Decreto de Repetición de ${SACRAMENTS[form.sacrament]} · actuación documental sin nueva partida`}
            right={
              <CanonicalDecreeMetaGrid>
                <CanonicalField label="Número de decreto">
                  <Input required name="numeroDecreto" value={form.number} maxLength={80}
                    onChange={event=>set('number',event.target.value.toUpperCase())}
                    placeholder="Ej. 005-2026" className={canonicalInputClass}/>
                </CanonicalField>
                <CanonicalField label="Fecha de emisión">
                  <Input required type="date" name="fechaDecreto" value={form.date}
                    max={new Date().toISOString().slice(0,10)}
                    onChange={event=>set('date',event.target.value)}
                    className={canonicalInputClass}/>
                </CanonicalField>
                <CanonicalField label="Concepto">
                  <select required className={canonicalSelectClass} value={form.conceptId}
                    onChange={event=>set('conceptId',event.target.value)}>
                    <option value="">Seleccione...</option>
                    {eligibleConcepts.map(c=>(
                      <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>
                    ))}
                  </select>
                </CanonicalField>
              </CanonicalDecreeMetaGrid>
            }
          />
          <div className="px-6 pt-5">
            <DecreeConceptEffects concept={selectedConcept}/>
            {selectedConcept?.sacrament_type==='general'&&
              <p className="mt-2 text-[10px] leading-relaxed text-blue-800">
                El concepto histórico es transversal («General»), pero este decreto queda
                registrado específicamente en {SACRAMENTS[form.sacrament]}.
              </p>}
          </div>
          <CanonicalDetailBody>
            <CanonicalNotice
              tone="blue"
              title="Naturaleza del decreto de Repetición"
              text="Repetición puede referirse a una inscripción duplicada o a otro error histórico. Cancillería decide por escrito el tratamiento de cada partida. No cambia automáticamente datos sacramentales, no elimina el hecho histórico ni crea nuevas coordenadas."
            />

            {form.sacrament==='bautismo'&&<section className="space-y-3">
              <CanonicalSectionTitle title="Naturaleza del expediente" subtitle="Distinga duplicidad de partidas de errores de transcripción."/>
              <select className={canonicalSelectClass} value={form.caseMode||'documentary'}
                onChange={e=>set('caseMode',e.target.value)}>
                <option value="documentary">Error histórico / actuación documental (V312)</option>
                <option value="duplicate_baptism_entries">Dos o más partidas del mismo bautizado</option>
              </select>
            </section>}
            {form.sacrament==='bautismo'&&form.caseMode==='duplicate_baptism_entries'&&
              <RepetitionDuplicateEntriesForm entries={form.affectedEntries||[]}
                onChange={value=>set('affectedEntries',value)} parishes={parishes}/>}
            <section>
              <CanonicalSectionTitle title={`Datos de ${SACRAMENTS[form.sacrament]}`}
                subtitle="Identificación del interesado del expediente, sin modificar la partida original."/>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <CanonicalField label="Nombre completo del titular" className="md:col-span-2">
                  <Input required name="titular" value={form.target} maxLength={300}
                    onChange={event=>set('target',event.target.value.toUpperCase())}
                    className={canonicalInputClass}/>
                </CanonicalField>
              </div>
            </section>

            <CanonicalReasonPanel value={form.reason}
              onChange={value=>set('reason',value)}
              placeholder="Explique el error de transcripción o la repetición, sus antecedentes y el fundamento de la actuación..."
            />

            <section>
              <CanonicalSectionTitle title="Evidencia y antecedentes"
                subtitle="Referencia verificable del registro o documentación original; no genera un asiento nuevo."/>
              <div className="mt-4 grid gap-3">
                <CanonicalField label="Referencia documental / Libro, Folio y Número originales, si constan">
                  <Input required name="referenciaDocumental" minLength={8} maxLength={1000}
                    value={form.evidence} onChange={event=>set('evidence',event.target.value)}
                    placeholder="Documento, expediente, libro, folio, número u otra evidencia..."
                    className={canonicalInputClass}/>
                </CanonicalField>
              </div>
            </section>

            <section>
              <CanonicalSectionTitle title="Disposición de Cancillería"
                subtitle="Indique exactamente qué debe verificar y documentar la parroquia destinataria."/>
              <textarea required minLength={15} maxLength={4000} rows={4}
                className={canonicalTextareaClass} value={form.instruction}
                onChange={event=>set('instruction',event.target.value)}/>
            </section>

            <section>
              <CanonicalSectionTitle title="Ministro y autoridad" subtitle="El DA FE corresponde al Canciller o Vicecanciller designado."/>
              <div className="mt-4 grid gap-3">
                <CanonicalField label="DA FE · Autoridad que expide el decreto">
                  <select required className={canonicalSelectClass} value={form.signer}
                    onChange={event=>set('signer',event.target.value)}>
                    <option value="canciller" disabled={!signers.canciller}>
                      Canciller · {signers.canciller||'No configurado'}
                    </option>
                    <option value="vicecanciller" disabled={!signers.viceCanciller}>
                      Vicecanciller · {signers.viceCanciller||'No configurado'}
                    </option>
                  </select>
                </CanonicalField>
              </div>
            </section>
          </CanonicalDetailBody>
          <CanonicalActionFooter>
            <Button type="submit" disabled={busy||loading||!!remaining}
              className="h-12 w-full bg-amber-500 font-black text-slate-950 hover:bg-amber-600">
              {busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}
              {form.caseMode==='duplicate_baptism_entries'?'Expedir y notificar a las parroquias':'Expedir repetición y notificar a la parroquia'}
            </Button>
          </CanonicalActionFooter>
        </CanonicalDetailPanel>
      )}
    </form>
  );
}
