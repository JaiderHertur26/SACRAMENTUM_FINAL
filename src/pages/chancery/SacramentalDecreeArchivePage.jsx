import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useSearchParams } from 'react-router-dom';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import { supabase } from '@/lib/supabaseClient';
import { listDecrees } from '@/services/decreeRegistryService';
import {
  Search,
  Printer,
  RotateCcw,
  History,
  Loader2,
  RefreshCw,
  FileCheck2,
  ArchiveRestore
} from 'lucide-react';
import { institutionalConfirm, institutionalPrompt } from '@/lib/institutionalDialog';

const SACRAMENT_KEY = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('confirm')) return 'confirmacion';
  if (v.includes('matrim')) return 'matrimonio';
  if (v.includes('exequ') || v.includes('funer')) return 'exequias';
  if (v.includes('baut')) return 'bautismo';
  return null;
};

const TYPE_KEY = (value) => {
  const v = String(value || '').toLowerCase();
  if (!v) return null;
  if (v.includes('nulidad')) return null;
  if (v.includes('repos') || v.includes('replacement')) return 'reposicion';
  if (v.includes('correc')) return 'correccion';
  return null;
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getOriginalLocation = (payload = {}) =>
  payload.originalLocation || payload.originalPartidaSummary || {};

const getReplacementLocation = (payload = {}) =>
  payload.replacementLocation || payload.newPartidaSummary || {};

const getEvidence = (payload = {}) =>
  payload.evidence || payload.decreeEvidence || payload.recordData?.evidence || {};

const getNote = (payload = {}, type) => {
  if (type === 'correccion') {
    return payload.replacementNote || payload.originalNote || payload.notaMarginal || '';
  }
  return payload.replacementNote || payload.notaMarginal || '';
};

const SacramentalDecreeArchivePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const sacrament = SACRAMENT_KEY(searchParams.get('sacrament')) || 'bautismo';
  const forcedType = TYPE_KEY(searchParams.get('type'));

  const [dioceseId, setDioceseId] = useState(user?.dioceseId || user?.diocese_id || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(forcedType || 'all');

  useEffect(() => {
    setTypeFilter(forcedType || 'all');
  }, [forcedType]);

  useEffect(() => {
    const resolve = async () => {
      if (user?.dioceseId || user?.diocese_id) {
        setDioceseId(user.dioceseId || user.diocese_id);
        return;
      }

      const chanceryId = user?.chanceryId || user?.chancery_id;
      if (!chanceryId) return;

      const { data, error } = await supabase
        .from('chancelleries')
        .select('diocese_id')
        .eq('id', chanceryId)
        .maybeSingle();

      if (error) throw error;
      setDioceseId(data?.diocese_id || '');
    };

    resolve().catch((error) =>
      toast({
        title: 'Cancillería',
        description: error.message,
        variant: 'destructive'
      })
    );
  }, [user, toast]);

  const load = async () => {
    if (!dioceseId) return;

    setLoading(true);

    try {
      const { data: parishes, error } = await supabase
        .from('parishes')
        .select('id,name')
        .eq('diocese_id', dioceseId);

      if (error) throw error;

      const ids = (parishes || []).map((p) => p.id);
      const names = new Map((parishes || []).map((p) => [p.id, p.name]));
      const all = await listDecrees({ parishIds: ids });

      setRows(
        (all || [])
          .filter((d) => {
            const type = TYPE_KEY(
              d.tipo || d.payload?.decreeType || d.payload?.decretoType
            );
            return Boolean(type);
          })
          .map((d) => ({
            ...d,
            parish_name:
              names.get(d.parish_id) ||
              d.payload?.parishName ||
              d.payload?.targetParishName ||
              ''
          }))
      );
    } catch (error) {
      toast({
        title: 'Archivo de decretos',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dioceseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const rowSacrament = SACRAMENT_KEY(
        row.sacrament_type ||
          row.payload?.sacramentType ||
          row.payload?.sacramento ||
          row.payload?.sacrament
      );

      if (rowSacrament !== sacrament) return false;

      const type = TYPE_KEY(
        row.tipo || row.payload?.decreeType || row.payload?.decretoType
      );

      if (!type) return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;

      if (!q) return true;

      return [
        row.decree_number,
        row.payload?.decreeNumber,
        row.payload?.targetName,
        row.payload?.newTargetName,
        row.parish_name,
        row.status,
        type
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, sacrament, typeFilter]);

  const reverse = async (row) => {
    if (String(row.status || '').toLowerCase() === 'reversed') return;

    const type = TYPE_KEY(
      row.tipo || row.payload?.decreeType || row.payload?.decretoType
    );

    if (!type) return;

    const number =
      row.decree_number || row.payload?.decreeNumber || 'el decreto';

    const reason = await institutionalPrompt({
      title: 'Motivo de reversión',
      message: `Indique por qué se revertirá ${number}. Este motivo quedará en la trazabilidad institucional.`,
      placeholder: 'Escriba el motivo de la reversión…',
      confirmText: 'Continuar',
      tone: 'warning',
      required: true,
      minLength: 3
    });
    if (reason === null) return;

    const correctionText =
      'La partida original recuperará vigencia y la nueva partida supletoria quedará revertida.';
    const repositionText =
      'La partida creada por reposición quedará revertida. No existe una partida original que reactivar.';

    if (!(await institutionalConfirm({
      title: type === 'correccion' ? 'Revertir corrección' : 'Revertir reposición',
      message: `${type === 'correccion' ? correctionText : repositionText}\n\nLos consecutivos ya consumidos no se reutilizan.`,
      confirmText: 'Sí, revertir decreto',
      tone: 'destructive'
    }))) {
      return;
    }

    try {
      if (sacrament === 'matrimonio') {
        const { error } = await supabase.rpc('reverse_marriage_decree', {
          p_decree_id: row.id,
          p_reason: reason.trim()
        });
        if (error) throw error;
      } else if (sacrament === 'exequias') {
        const { error } = await supabase.rpc('reverse_funeral_decree', {
          p_decree_id: row.id,
          p_reason: reason.trim()
        });
        if (error) throw error;
      } else if (type === 'correccion') {
        const { error } = await supabase.rpc(
          'reverse_correction_decree_with_reason',
          {
            p_decree_id: row.id,
            p_reason: reason.trim()
          }
        );
        if (error) {
          if (
            String(error.message || '').includes(
              'reverse_correction_decree_with_reason'
            ) ||
            String(error.message || '').includes('Could not find the function')
          ) {
            throw new Error(
              'Falta aplicar la migración 033B de reversión auditada para Bautismo/Confirmación.'
            );
          }
          throw error;
        }
      } else {
        const { error } = await supabase.rpc(
          'reverse_replacement_decree_with_reason',
          {
            p_decree_id: row.id,
            p_reason: reason.trim()
          }
        );
        if (error) {
          if (
            String(error.message || '').includes(
              'reverse_replacement_decree_with_reason'
            ) ||
            String(error.message || '').includes('Could not find the function')
          ) {
            throw new Error(
              'Falta aplicar la migración 033B de reversión auditada para Bautismo/Confirmación.'
            );
          }
          throw error;
        }
      }

      toast({
        title: 'Decreto revertido',
        description:
          'El motivo de reversión quedó conservado junto con la trazabilidad histórica.',
        className: 'bg-green-50 border-green-200 text-green-900'
      });

      await load();
    } catch (error) {
      toast({
        title: 'No se pudo revertir',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const print = (row) => {
    const payload = row.payload || {};
    const type = TYPE_KEY(
      row.tipo || payload.decreeType || payload.decretoType
    );

    if (!type) return;

    const number = escapeHtml(
      row.decree_number || payload.decreeNumber || 'Decreto'
    );

    const title =
      type === 'correccion'
        ? 'DECRETO DE CORRECCIÓN'
        : 'DECRETO DE REPOSICIÓN';

    const sacramentLabel =
      sacrament === 'confirmacion'
        ? 'CONFIRMACIÓN'
        : sacrament === 'matrimonio'
        ? 'MATRIMONIO'
        : sacrament === 'exequias'
        ? 'EXEQUIAS'
        : 'BAUTISMO';

    const original = getOriginalLocation(payload);
    const replacement = getReplacementLocation(payload);
    const evidence = getEvidence(payload);
    const note = getNote(payload, type);

    const originalBlock =
      type === 'correccion'
        ? `
          <div class="box">
            <span>PARTIDA ORIGINAL · ANULADA</span>
            <strong>
              L-${escapeHtml(original.book || original.libro || '—')} ·
              F-${escapeHtml(original.folio || original.page || '—')} ·
              N-${escapeHtml(original.number || original.entry || '—')}
            </strong>
            ${
              original.numeroRegistro || original.numero_registro
                ? `<small>REG. ${escapeHtml(
                    original.numeroRegistro || original.numero_registro
                  )}</small>`
                : ''
            }
          </div>
        `
        : '';

    const evidenceBlock =
      type === 'reposicion'
        ? `
          <div class="evidence">
            <b>Evidencia registrada</b><br>
            Tipo: ${escapeHtml(evidence.type || '—')}<br>
            Referencia: ${escapeHtml(evidence.reference || '—')}<br>
            Emisor / custodio: ${escapeHtml(evidence.issuer || '—')}<br>
            Fecha: ${escapeHtml(evidence.date || '—')}<br>
            <span>${escapeHtml(evidence.description || '')}</span>
          </div>
        `
        : '';

    const replacementRegistry =
      replacement.numeroRegistro ||
      replacement.numero_registro ||
      payload.numeroRegistro ||
      payload.numero_registro ||
      '';

    const relationText =
      type === 'correccion'
        ? 'La partida original queda anulada y se crea una nueva partida en el Libro Supletorio, conservando la relación jurídica y documental entre ambos asientos.'
        : 'No existe una partida original utilizable. Con fundamento en la evidencia incorporada al expediente, se crea una nueva partida en el Libro Supletorio.';

    const popup = window.open('', '_blank', 'width=900,height=1100');

    if (!popup) {
      toast({
        title: 'Ventana bloqueada',
        description: 'Permita ventanas emergentes para imprimir.',
        variant: 'destructive'
      });
      return;
    }

    popup.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${number}</title>
<style>
@page{size:Letter;margin:18mm}
*{box-sizing:border-box}
body{font-family:Georgia,serif;color:#172033;margin:0;line-height:1.6}
.page{border:1.5px solid #274f78;padding:34px 42px;position:relative}
.page:before{content:'';position:absolute;inset:8px;border:1px solid #d4af37;pointer-events:none}
.k{text-align:center;font:700 9px Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#9a7921}
h1{text-align:center;font-size:21px;margin:8px 0 2px}
h2{text-align:center;font-size:14px;font-weight:normal;margin:0 0 25px}
.meta{border-top:1px solid #ccd4de;border-bottom:1px solid #ccd4de;padding:14px 0;font-size:12px;margin:20px 0}
.locations{display:grid;grid-template-columns:${type === 'correccion' ? '1fr 1fr' : '1fr'};gap:12px;margin:18px 0}
.box{padding:12px;background:#f8fafc;border:1px solid #dce3eb}
.box span{display:block;font:700 8px Arial,sans-serif;letter-spacing:.12em;color:#7b8796}
.box strong{display:block;margin-top:4px;font:700 11px Arial,sans-serif}
.box small{display:block;margin-top:4px;font:700 9px Arial,sans-serif;color:#596575}
p{font-size:12px;text-align:justify}
.evidence,.note{margin-top:18px;padding:13px;border-left:3px solid #d4af37;background:#fbfaf6;font-size:11px}
.sig{margin-top:75px;text-align:center}
.small{text-align:center;margin-top:30px;font:400 8px Arial,sans-serif;color:#7d8793}
</style>
</head>
<body>
<div class="page">
  <div class="k">Cancillería Diocesana · Gobierno Documental · SACRAMENTUM</div>
  <h1>${title} · ${sacramentLabel}</h1>
  <h2>${number}</h2>

  <div class="meta">
    <b>Fecha:</b> ${escapeHtml(
      row.decree_date || payload.decreeDate || ''
    )}<br>
    <b>Parroquia:</b> ${escapeHtml(
      row.parish_name ||
        payload.parishName ||
        payload.targetParishName ||
        ''
    )}<br>
    <b>Titular:</b> ${escapeHtml(
      payload.targetName || payload.newTargetName || ''
    )}
  </div>

  <div class="locations">
    ${originalBlock}
    <div class="box">
      <span>PARTIDA SUPLETORIA</span>
      <strong>
        L-${escapeHtml(replacement.book || replacement.libro || '—')} ·
        F-${escapeHtml(replacement.folio || replacement.page || '—')} ·
        N-${escapeHtml(replacement.number || replacement.entry || '—')}
      </strong>
      ${
        replacementRegistry
          ? `<small>REG. ${escapeHtml(replacementRegistry)}</small>`
          : ''
      }
    </div>
  </div>

  <p>${relationText}</p>

  <p><b>Fundamento:</b> ${escapeHtml(
    payload.reason ||
      payload.fundamento ||
      payload.causa ||
      payload.observaciones ||
      ''
  )}</p>

  ${evidenceBlock}

  ${
    note
      ? `<div class="note"><b>Nota marginal</b><br>${escapeHtml(
          note
        )}</div>`
      : ''
  }

  <div class="sig">
    ___________________________________<br>
    <b>CANCILLERÍA DIOCESANA</b>
  </div>

  <div class="small">
    Documento generado por SACRAMENTUM. El expediente digital conserva decreto,
    evidencia cuando aplica, notas marginales, reversión y auditoría.
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body>
</html>`);

    popup.document.close();
  };

  const updateType = (value) => {
    setTypeFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('type');
    else next.set('type', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader mode="archive" sacrament={sacrament} />

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                Archivo diocesano
              </p>
              <h2 className="mt-1 font-serif text-2xl font-black text-slate-950">
                Decretos sacramentales
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Único archivo para Corrección y Reposición. La nulidad matrimonial
                pertenece al Tribunal Eclesiástico y no forma parte de este Centro.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateType('all')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  typeFilter === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => updateType('correccion')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  typeFilter === 'correccion'
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Correcciones
              </button>
              <button
                onClick={() => updateType('reposicion')}
                className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest ${
                  typeFilter === 'reposicion'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Reposiciones
              </button>
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-100 p-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar decreto, fiel, parroquia o estado"
              />
            </div>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <History className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">
                No hay decretos para este filtro.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const type = TYPE_KEY(
                  row.tipo ||
                    row.payload?.decreeType ||
                    row.payload?.decretoType
                );
                const reversed =
                  String(row.status || '').toLowerCase() === 'reversed';
                const Icon =
                  type === 'correccion' ? FileCheck2 : ArchiveRestore;

                const payload = row.payload || {};
                const original = getOriginalLocation(payload);
                const replacement = getReplacementLocation(payload);

                return (
                  <article key={row.id} className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            type === 'correccion'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-slate-950">
                              {row.decree_number ||
                                row.payload?.decreeNumber ||
                                'Decreto'}
                            </h3>
                            <span
                              className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                                type === 'correccion'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {type === 'correccion'
                                ? 'Corrección'
                                : 'Reposición'}
                            </span>
                            {reversed && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[8px] font-black uppercase text-red-700">
                                Revertido
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm font-bold uppercase text-slate-700">
                            {row.payload?.targetName ||
                              row.payload?.newTargetName ||
                              'Expediente sacramental'}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {row.parish_name} ·{' '}
                            {row.decree_date ||
                              row.payload?.decreeDate ||
                              '—'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px]">
                            {type === 'correccion' && (
                              <span className="text-red-600">
                                Original anulada: L-
                                {original.book || original.libro || '—'} · F-
                                {original.folio || original.page || '—'} · N-
                                {original.number || original.entry || '—'}
                              </span>
                            )}

                            <span className="text-amber-700">
                              Supletoria: L-
                              {replacement.book || replacement.libro || '—'} ·
                              F-{replacement.folio || replacement.page || '—'} ·
                              N-{replacement.number || replacement.entry || '—'}
                              {(
                                replacement.numeroRegistro ||
                                replacement.numero_registro
                              )
                                ? ` · REG. ${
                                    replacement.numeroRegistro ||
                                    replacement.numero_registro
                                  }`
                                : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => print(row)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Imprimir
                        </Button>
                        {!reversed && (
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => reverse(row)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Revertir
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SacramentalDecreeArchivePage;
