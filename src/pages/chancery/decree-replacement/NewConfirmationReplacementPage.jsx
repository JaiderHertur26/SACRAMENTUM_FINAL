import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, BookOpen, Church, FileSignature, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import {
  CanonicalParishSelector,
  CanonicalField,
  CanonicalSectionTitle,
  CanonicalMasterPanel,
  CanonicalEmptyPanel,
  CanonicalDetailPanel,
  CanonicalDetailHeader,
  CanonicalSupplementaryPreview,
  CanonicalNotice,
  CanonicalActionFooter,
  CanonicalDecreeMetaGrid,
  CanonicalDetailBody,
  CanonicalReasonPanel,
  canonicalSelectClass,
  canonicalTextareaClass,
  EVIDENCE_TYPES
} from '@/components/chancery/CanonicalDecreePrimitives';

const localDateISO = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };

const cleanTitle = (value) => String(value || '').replace(/^(PBRO\.?\s*|PADRE\s*|FRAY\s*|MONS\.?\s*|SACERDOTE\s*)/i, '').trim();
const upper = (value) => String(value || '').toUpperCase();

const EMPTY = {
  fechaSacramento: '', horaSacramento: '', lugarSacramento: '', apellidos: '', nombres: '', sexo: '',
  fechaNacimiento: '', lugarNacimiento: '', nuip: '', direccion: '', nombrePadre: '', cedulaPadre: '',
  nombreMadre: '', cedulaMadre: '', abuelosPaternos: '', abuelosMaternos: '', tipoUnionPadres: '',
  fechaBautismo: '', lugarBautismo: '', numeroRegistro: '', padrinos: '', ministro: '', daFe: '', observaciones: ''
};

const NewConfirmationReplacementPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [dioceseId, setDioceseId] = useState('');
  const [parishes, setParishes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [targetParishId, setTargetParishId] = useState('');
  const [params, setParams] = useState({});
  const [decree, setDecree] = useState({ number: '', date: localDateISO(), conceptId: '' });
  const [record, setRecord] = useState(EMPTY);
  const [parishQuery, setParishQuery] = useState('');
  const [evidence, setEvidence] = useState({ type: '', reference: '', issuer: '', date: '', description: '' });
  const [decreeReason, setDecreeReason] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      let dId = user.dioceseId || user.diocese_id || '';
      if (!dId && (user.chanceryId || user.chancery_id)) {
        const { data, error } = await supabase.from('chancelleries').select('diocese_id').eq('id', user.chanceryId || user.chancery_id).single();
        if (error) throw error;
        dId = data?.diocese_id || '';
      }
      if (!dId) throw new Error('No se pudo determinar la diócesis de Cancillería.');
      setDioceseId(dId);
      const [pRes, cRes] = await Promise.all([
        supabase.from('parishes').select('id,name,city').eq('diocese_id', dId).order('name'),
        supabase.from('conceptos_anulacion').select('id,codigo,concepto,tipo').eq('diocese_id', dId).order('codigo')
      ]);
      if (pRes.error) throw pRes.error;
      if (cRes.error) throw cRes.error;
      setParishes(pRes.data || []);
      setConcepts((cRes.data || []).filter(c => c.tipo === 'porReposicion' || String(c.concepto || '').toLowerCase().includes('reposici')));
    };
    load().catch(error => toast({ title: 'Configuración incompleta', description: error.message, variant: 'destructive' }));
  }, [user, toast]);

  useEffect(() => {
    const loadParish = async () => {
      setParams({});
      if (!targetParishId) return;
      const pRes = await supabase
        .from('parish_parameters')
        .select('confirmaciones_params')
        .eq('parish_id', targetParishId)
        .maybeSingle();
      if (pRes.error) throw pRes.error;
      setParams(pRes.data?.confirmaciones_params || {});
    };
    loadParish().catch(error => toast({ title: 'Parroquia', description: error.message, variant: 'destructive' }));
  }, [targetParishId, toast]);

  const next = useMemo(() => ({
    book: Number(params.suplementarioLibro || 1), folio: Number(params.suplementarioFolio || 1), number: Number(params.suplementarioNumero || 1)
  }), [params]);

  const setField = (name, value, raw = false) => setRecord(prev => ({ ...prev, [name]: raw ? value : upper(value) }));
  const parish = parishes.find(p => p.id === targetParishId);

  const handleSubmit = async () => {
    if (!targetParishId || !decree.number.trim() || !decree.date || !decree.conceptId || !record.nombres.trim() || !record.apellidos.trim() || !record.fechaSacramento) {
      toast({ title: 'Datos incompletos', description: 'Parroquia, decreto, concepto, fecha de Confirmación, nombres y apellidos son obligatorios.', variant: 'destructive' });
      return;
    }
    if (!evidence.type || !evidence.reference.trim() || !evidence.issuer.trim() || !evidence.description.trim()) {
      toast({ title: 'Evidencia obligatoria', description: 'La reposición exige tipo, referencia, emisor/custodio y descripción de la evidencia.', variant: 'destructive' });
      return;
    }
    if (!decreeReason.trim()) {
      toast({ title: 'Fundamento obligatorio', description: 'Explique por qué procede la reposición y cómo la evidencia acredita la Confirmación.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const daFeClean = cleanTitle(record.daFe);
      const finalDaFe = daFeClean ? `PBRO. ${upper(daFeClean)}` : '';
      const ministroClean = cleanTitle(record.ministro);
      const finalMinister = ministroClean ? upper(ministroClean) : '';
      const concept = concepts.find(c => String(c.id) === String(decree.conceptId));
      const dateText = convertDateToSpanishText(decree.date).replace(/^EL\s+/i, '').toUpperCase();
      const daFeClause = finalDaFe ? ` DA FE: ${finalDaFe}.` : '';
      const note = `ESTA PARTIDA DE CONFIRMACIÓN SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. ${upper(decree.number)} DE FECHA ${dateText}${concept?.concepto ? `, MOTIVO: ${upper(concept.concepto)}` : ''}.${daFeClause}`;
      const normalized = { ...record, ministro: finalMinister, daFe: finalDaFe, status: 'seated', estado: 'permanente', decreeEvidence: evidence, reason: decreeReason.trim(), fundamento: decreeReason.trim() };
      const payload = {
        sacrament: 'confirmacion', sacramentType: 'confirmacion', decretoType: 'reposicion',
        decreeNumber: upper(decree.number), decreeDate: decree.date, conceptoAnulacionId: decree.conceptId,
        causa: concept?.concepto || 'REPOSICIÓN', reason: decreeReason.trim(), fundamento: decreeReason.trim(), targetParishId, targetParishName: parish?.name || '',
        targetName: `${upper(record.apellidos)} ${upper(record.nombres)}`.trim(), ...normalized, evidence,
        newPartidaSummary: { book: next.book, page: next.folio, entry: next.number, nombres: record.nombres, apellidos: record.apellidos, daFe: finalDaFe }
      };
      const { data, error } = await supabase.rpc('apply_confirmation_replacement', {
        p_parish_id: targetParishId,
        p_decree_number: upper(decree.number),
        p_decree_date: decree.date,
        p_concept_id: decree.conceptId,
        p_new_data: normalized,
        p_decree_payload: payload,
        p_replacement_note: note,
        p_expected_book: next.book,
        p_expected_folio: next.folio,
        p_expected_number: next.number
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      toast({ title: 'Reposición de Confirmación emitida', description: `Partida supletoria L-${result?.book_number || next.book} F-${result?.folio || next.folio} N-${result?.number || next.number}.`, className: 'bg-green-50 text-green-900 border-green-200' });
      navigate('/chancery/decretos/archivo?sacrament=confirmacion&type=reposicion');
    } catch (error) {
      toast({ title: 'No se pudo emitir', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const filteredParishes = parishes.filter((p) => {
    const q = parishQuery.trim().toLowerCase();
    if (!q) return true;
    return `${p.name || ''} ${p.city || ''}`.toLowerCase().includes(q);
  });

  const label = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2';
  const input = 'w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold uppercase';
  const Field = ({ title, children, className='' }) => <div className={className}><label className={label}>{title}</label>{children}</div>;

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-[1500px] space-y-7 pb-20">
        <DecreeCenterHeader mode="reposition" sacrament="confirmacion" />

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.35fr]">
          <CanonicalMasterPanel
            kicker="01 · Parroquia de destino"
            footer={
              <div className="border-t border-amber-100 bg-amber-50/60 p-4 text-[10px] leading-relaxed text-amber-800">
                La reposición sólo procede cuando no existe una partida original utilizable y existe evidencia suficiente de que la Confirmación sí fue celebrada.
              </div>
            }
          >
            <CanonicalParishSelector
              parishes={parishes}
              value={targetParishId}
              query={parishQuery}
              onQueryChange={setParishQuery}
              onChange={(parishId) => setTargetParishId(parishId)}
            />
          </CanonicalMasterPanel>

          {!targetParishId ? (
            <CanonicalEmptyPanel
              title="Seleccione la parroquia de destino"
              text="No se selecciona una partida original. La reposición reconstruye el asiento con base en evidencia suficiente."
            />
          ) : (
            <CanonicalDetailPanel>
              <CanonicalDetailHeader
                title={parish?.name || 'Parroquia seleccionada'}
                subtitle="Nueva partida de Confirmación por reposición · sin partida original asociada"
                right={
                  <CanonicalDecreeMetaGrid>
                    <CanonicalField label="Número de decreto"><Input value={decree.number} onChange={(e) => setDecree((d) => ({ ...d, number: upper(e.target.value) }))} placeholder="Ej. 005-2026" /></CanonicalField>
                    <CanonicalField label="Fecha de emisión"><Input type="date" value={decree.date} onChange={(e) => setDecree((d) => ({ ...d, date: e.target.value }))} /></CanonicalField>
                    <CanonicalField label="Concepto">
                      <select value={decree.conceptId} onChange={(e) => setDecree((d) => ({ ...d, conceptId: e.target.value }))} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        {concepts.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.concepto}</option>)}
                      </select>
                    </CanonicalField>
                  </CanonicalDecreeMetaGrid>
                }
              />

              <CanonicalSupplementaryPreview
                book={String(next.book).padStart(4,'0')}
                folio={String(next.folio).padStart(4,'0')}
                number={String(next.number).padStart(4,'0')}
                blocked={Boolean(params.suplementarioBlocked)}
              />

              <CanonicalDetailBody>
                <CanonicalNotice
                  tone="blue"
                  title="Naturaleza de la reposición"
                  text="No se anula ninguna partida porque no existe un asiento original utilizable. La nueva partida supletoria se sustenta en evidencia de que la Confirmación sí se celebró."
                />

                <section>
                  <CanonicalSectionTitle title="Datos del confirmado" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Apellidos"><Input value={record.apellidos} onChange={(e) => setField('apellidos', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Nombres"><Input value={record.nombres} onChange={(e) => setField('nombres', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Sexo">
                      <select value={record.sexo} onChange={(e) => setField('sexo', e.target.value, true)} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMENINO">Femenino</option>
                      </select>
                    </CanonicalField>
                    <CanonicalField label="Fecha nacimiento"><Input type="date" value={record.fechaNacimiento} onChange={(e) => setField('fechaNacimiento', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Lugar nacimiento"><Input value={record.lugarNacimiento} onChange={(e) => setField('lugarNacimiento', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Documento / NUIP"><Input value={record.nuip} onChange={(e) => setField('nuip', e.target.value)} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Celebración de la Confirmación" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Fecha"><Input type="date" value={record.fechaSacramento} onChange={(e) => setField('fechaSacramento', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Hora"><Input type="time" value={record.horaSacramento} onChange={(e) => setField('horaSacramento', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Lugar / templo"><Input value={record.lugarSacramento} onChange={(e) => setField('lugarSacramento', e.target.value)} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Familia y Bautismo de origen" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Padre"><Input value={record.nombrePadre} onChange={(e) => setField('nombrePadre', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Madre"><Input value={record.nombreMadre} onChange={(e) => setField('nombreMadre', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Fecha Bautismo"><Input type="date" value={record.fechaBautismo} onChange={(e) => setField('fechaBautismo', e.target.value, true)} /></CanonicalField>
                    <CanonicalField label="Lugar Bautismo"><Input value={record.lugarBautismo} onChange={(e) => setField('lugarBautismo', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Número registro"><Input value={record.numeroRegistro} onChange={(e) => setField('numeroRegistro', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Padrinos"><Input value={record.padrinos} onChange={(e) => setField('padrinos', e.target.value)} /></CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Ministro y autoridad" />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Ministro"><Input value={record.ministro} onChange={(e) => setField('ministro', e.target.value)} /></CanonicalField>
                    <CanonicalField label="Da fe"><Input value={record.daFe} onChange={(e) => setField('daFe', e.target.value)} /></CanonicalField>
                  </div>
                </section>
                <CanonicalReasonPanel
                  value={decreeReason}
                  onChange={setDecreeReason}
                  placeholder="Explique por qué procede reconstruir el asiento y por qué la evidencia es suficiente..."
                />

                <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <CanonicalSectionTitle title="Evidencia de la celebración" subtitle="Identifique el documento o conjunto probatorio que permite reconstruir la partida." />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CanonicalField label="Tipo de evidencia">
                      <select value={evidence.type} onChange={(e) => setEvidence((v) => ({ ...v, type: e.target.value }))} className={canonicalSelectClass}>
                        <option value="">Seleccione...</option>
                        {EVIDENCE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </CanonicalField>
                    <CanonicalField label="Referencia"><Input value={evidence.reference} onChange={(e) => setEvidence((v) => ({ ...v, reference: e.target.value }))} /></CanonicalField>
                    <CanonicalField label="Emisor / custodio"><Input value={evidence.issuer} onChange={(e) => setEvidence((v) => ({ ...v, issuer: upper(e.target.value) }))} /></CanonicalField>
                    <CanonicalField label="Fecha del documento"><Input type="date" value={evidence.date} onChange={(e) => setEvidence((v) => ({ ...v, date: e.target.value }))} /></CanonicalField>
                    <CanonicalField label="Descripción" className="md:col-span-2">
                      <textarea value={evidence.description} onChange={(e) => setEvidence((v) => ({ ...v, description: e.target.value }))} className={canonicalTextareaClass} />
                    </CanonicalField>
                  </div>
                </section>

                <section>
                  <CanonicalSectionTitle title="Observaciones" />
                  <textarea value={record.observaciones} onChange={(e) => setField('observaciones', e.target.value)} className={`${canonicalTextareaClass} mt-3`} />
                </section>
              </CanonicalDetailBody>

              <CanonicalActionFooter>
                <Button onClick={handleSubmit} disabled={busy || !targetParishId || Boolean(params.suplementarioBlocked)} className="h-12 w-full bg-amber-500 font-black text-slate-950 hover:bg-amber-600">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Emitir Reposición y Crear Partida Supletoria
                </Button>
              </CanonicalActionFooter>
            </CanonicalDetailPanel>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NewConfirmationReplacementPage;
