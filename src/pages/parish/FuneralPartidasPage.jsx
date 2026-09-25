import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  BookOpen,
  Cross,
  Eye,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  User,
  X
} from 'lucide-react';
import {
  getFuneralInstitutionCloud,
  getFuneralMarginalNotesCloud,
  getFuneralsCloud
} from '@/services/funeralService';
import { cn } from '@/lib/utils';
import { labelStatus } from '@/utils/uiLabels';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const dateText = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const FuneralPartidasPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const parishId = user?.parishId || user?.parish_id || null;
  const parishName = user?.parishName || user?.parish_name || 'Parroquia';

  const [records, setRecords] = useState([]);
  const [institution, setInstitution] = useState({
    parishName,
    dioceseName: user?.dioceseName || 'DIÓCESIS / ARQUIDIÓCESIS',
    city: user?.city || ''
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [printNotes, setPrintNotes] = useState(true);

  const load = useCallback(async () => {
    if (!parishId) return;
    setLoading(true);

    try {
      const [rows, official] = await Promise.all([
        getFuneralsCloud(parishId),
        getFuneralInstitutionCloud({
          parishId,
          fallbackParish: parishName,
          fallbackDiocese: user?.dioceseName,
          fallbackCity: user?.city
        })
      ]);

      setRecords(rows);
      setInstitution(official);
    } catch (error) {
      toast({
        title: 'No fue posible cargar el Libro de Exequias',
        description: error?.message || 'Error consultando Supabase.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [parishId, parishName, toast, user?.dioceseName, user?.city]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    if (!term) return records;

    return records.filter((row) => {
      const haystack = [
        row.nombres,
        row.apellidos,
        row.book_number,
        row.folio,
        row.number,
        row.numero_registro,
        row.fecha_defuncion
      ].join(' ').toUpperCase();

      return haystack.includes(term);
    });
  }, [records, search]);

  const openRecord = async (row) => {
    setSelected(row);
    setNotes([]);
    setLoadingNotes(true);

    try {
      const remoteNotes = await getFuneralMarginalNotesCloud(row.id);
      setNotes(remoteNotes);
    } catch (error) {
      console.warn('No se pudieron cargar notas marginales:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const printCertificate = () => {
    if (!selected) return;

    const raw = selected.raw_data || {};
    const popup = window.open('', '_blank', 'width=900,height=1100');
    if (!popup) {
      toast({
        title: 'El navegador bloqueó la impresión',
        description: 'Permita ventanas emergentes para imprimir la partida.',
        variant: 'destructive'
      });
      return;
    }

    const noteList = [];
    if (selected.nota_marginal) noteList.push(selected.nota_marginal);
    if (printNotes) notes.forEach((note) => noteList.push(note.content));

    const notesHtml = noteList.length
      ? noteList.map((note) => `<div class="note">${escapeHtml(note)}</div>`).join('')
      : '<div class="empty">NINGUNA REGISTRADA.</div>';

    const sacraments = Array.isArray(raw.sacramentosRecibidos)
      ? raw.sacramentosRecibidos.join(', ')
      : '';

    const age = raw.edadDeclarada
      ? `${raw.edadDeclarada} ${raw.tipoEdad || 'años'}`
      : '';

    popup.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Partida de Exequias · SACRAMENTUM</title>
<style>
@page { size: Letter; margin: 14mm; }
* { box-sizing: border-box; }
body { margin:0; color:#172033; font-family: Georgia, 'Times New Roman', serif; background:#fff; }
.sheet { min-height: 245mm; border:1.5px solid #264f78; padding:22px 26px; position:relative; }
.sheet:before { content:''; position:absolute; inset:7px; border:1px solid #d8b85a; pointer-events:none; }
header { text-align:center; padding:4px 25px 18px; border-bottom:1px solid #d9e0e8; }
.diocese { font-size:12px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:#264f78; }
.parish { margin-top:5px; font-size:14px; font-weight:700; text-transform:uppercase; }
.city { margin-top:3px; font-size:9px; letter-spacing:.12em; color:#687385; text-transform:uppercase; }
.kicker { margin-top:20px; font-size:8px; letter-spacing:.35em; color:#a48123; text-transform:uppercase; }
h1 { margin:5px 0 0; font-size:28px; color:#172033; }
.ref { margin:20px 0; display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.ref div { padding:10px; border:1px solid #d9e0e8; text-align:center; }
.ref span { display:block; font:700 7px Arial,sans-serif; letter-spacing:.14em; color:#7b8593; text-transform:uppercase; }
.ref strong { display:block; margin-top:4px; font:700 13px Arial,sans-serif; color:#264f78; }
.intro { margin:18px 0; font-size:12px; line-height:1.65; text-align:justify; }
.section { margin-top:14px; border-top:1px solid #d9e0e8; padding-top:10px; }
.section-title { font:700 8px Arial,sans-serif; letter-spacing:.18em; color:#264f78; text-transform:uppercase; margin-bottom:8px; }
.row { display:grid; grid-template-columns:130px 1fr; gap:12px; padding:4px 0; font-size:11px; line-height:1.45; }
.row label { font:700 8px Arial,sans-serif; color:#7b8593; text-transform:uppercase; letter-spacing:.08em; }
.row strong { font-weight:700; }
.note { margin:5px 0; padding:7px 9px; border-left:3px solid #d8b85a; background:#fbfaf5; font-size:10px; line-height:1.45; }
.empty { font-size:10px; color:#7b8593; }
.signature { margin-top:34px; display:grid; grid-template-columns:1fr 1fr; gap:50px; }
.line { border-top:1px solid #172033; padding-top:6px; text-align:center; font:700 8px Arial,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
footer { margin-top:22px; text-align:center; font:400 7px Arial,sans-serif; color:#8a939f; letter-spacing:.08em; }
</style>
</head>
<body>
<div class="sheet">
<header>
  <div class="diocese">${escapeHtml(institution.dioceseName)}</div>
  <div class="parish">${escapeHtml(institution.parishName)}</div>
  <div class="city">${escapeHtml(institution.city)}</div>
  <div class="kicker">Certificación Eclesiástica</div>
  <h1>Partida de Exequias</h1>
</header>

<div class="ref">
  <div><span>Tipo de Libro</span><strong>${escapeHtml((selected.book_type || 'ordinario').toUpperCase())}</strong></div>
  <div><span>Libro</span><strong>${escapeHtml(selected.book_number || '—')}</strong></div>
  <div><span>Folio</span><strong>${escapeHtml(selected.folio || '—')}</strong></div>
  <div><span>Número</span><strong>${escapeHtml(selected.number || '—')}</strong></div>
</div>

<p class="intro">
El suscrito Párroco CERTIFICA que en el archivo parroquial consta el siguiente registro de Exequias:
</p>

<div class="section">
  <div class="section-title">Datos del difunto</div>
  <div class="row"><label>Nombre</label><strong>${escapeHtml(`${selected.nombres || ''} ${selected.apellidos || ''}`.trim())}</strong></div>
  <div class="row"><label>Sexo</label><div>${escapeHtml(selected.sexo || '—')}</div></div>
  <div class="row"><label>Nacimiento</label><div>${escapeHtml(dateText(selected.fecha_nacimiento))} ${selected.lugar_nacimiento ? '· ' + escapeHtml(selected.lugar_nacimiento) : ''}</div></div>
  ${age ? `<div class="row"><label>Edad</label><div>${escapeHtml(age)}</div></div>` : ''}
  ${raw.estadoCivil ? `<div class="row"><label>Estado civil</label><div>${escapeHtml(raw.estadoCivil)}</div></div>` : ''}
  <div class="row"><label>Padre</label><div>${escapeHtml(selected.nombre_padre || '—')}</div></div>
  <div class="row"><label>Madre</label><div>${escapeHtml(selected.nombre_madre || '—')}</div></div>
  ${selected.conyuge ? `<div class="row"><label>Cónyuge</label><div>${escapeHtml(selected.conyuge)}</div></div>` : ''}
</div>

<div class="section">
  <div class="section-title">Defunción y Exequias</div>
  <div class="row"><label>Defunción</label><strong>${escapeHtml(dateText(selected.fecha_defuncion))}</strong></div>
  <div class="row"><label>Lugar</label><div>${escapeHtml(selected.lugar_defuncion || '—')}</div></div>
  <div class="row"><label>Exequias</label><div>${escapeHtml(dateText(selected.fecha_exequias))} ${selected.hora_exequias ? '· ' + escapeHtml(String(selected.hora_exequias).slice(0,5)) : ''}</div></div>
  <div class="row"><label>Lugar Exequias</label><div>${escapeHtml(selected.lugar_exequias || '—')}</div></div>
  <div class="row"><label>Cementerio</label><div>${escapeHtml(selected.cementerio || '—')}</div></div>
  <div class="row"><label>Ministro</label><div>${escapeHtml(selected.ministro || '—')}</div></div>
  ${selected.da_fe ? `<div class="row"><label>Da fe</label><div>${escapeHtml(selected.da_fe)}</div></div>` : ''}
  ${sacraments ? `<div class="row"><label>Sacramentos recibidos</label><div>${escapeHtml(sacraments)}</div></div>` : ''}
</div>

<div class="section">
  <div class="section-title">Anotaciones marginales</div>
  ${notesHtml}
</div>

<div class="signature">
  <div class="line">PÁRROCO</div>
  <div class="line">FIRMA Y SELLO PARROQUIAL</div>
</div>

<footer>Documento expedido desde SACRAMENTUM · Registro Eclesial</footer>
</div>
<script>window.onload=()=>{window.print();};</script>
</body>
</html>`);
    popup.document.close();
  };


  const printFuneralSlip = (record = selected) => {
    if (!record) return;

    const popup = window.open('', '_blank', 'width=850,height=900');
    if (!popup) {
      toast({
        title: 'El navegador bloqueó la impresión',
        description: 'Permita ventanas emergentes para imprimir la Constancia de Exequias.',
        variant: 'destructive'
      });
      return;
    }

    const fullName = `${record.nombres || ''} ${record.apellidos || ''}`.trim();
    const funeralTime = record.hora_exequias
      ? String(record.hora_exequias).slice(0, 5)
      : '';

    popup.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Constancia de Exequias · SACRAMENTUM</title>
<style>
@page { size: Letter; margin: 16mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #fff;
  color: #172033;
  font-family: Georgia, 'Times New Roman', serif;
}
.sheet {
  max-width: 720px;
  margin: 0 auto;
  border: 1.5px solid #264f78;
  padding: 24px 28px 26px;
  position: relative;
}
.sheet:before {
  content: '';
  position: absolute;
  inset: 7px;
  border: 1px solid #d8b85a;
  pointer-events: none;
}
header {
  text-align: center;
  padding: 2px 18px 17px;
  border-bottom: 1px solid #d9e0e8;
}
.diocese {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: #264f78;
}
.parish {
  margin-top: 5px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
}
.city {
  margin-top: 3px;
  font-size: 9px;
  letter-spacing: .12em;
  color: #687385;
  text-transform: uppercase;
}
.kicker {
  margin-top: 17px;
  font: 700 8px Arial, sans-serif;
  letter-spacing: .28em;
  color: #a48123;
  text-transform: uppercase;
}
h1 {
  margin: 5px 0 0;
  font-size: 25px;
}
.control {
  margin: 18px 0;
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
  gap: 7px;
}
.control div {
  border: 1px solid #d9e0e8;
  padding: 9px 7px;
  text-align: center;
}
.control span {
  display: block;
  font: 700 7px Arial, sans-serif;
  color: #7b8593;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.control strong {
  display: block;
  margin-top: 4px;
  font: 700 12px Arial, sans-serif;
  color: #264f78;
}
.statement {
  margin: 19px 0 17px;
  font-size: 12px;
  line-height: 1.7;
  text-align: justify;
}
.name {
  margin: 14px 0 18px;
  padding: 13px 15px;
  background: #f6f8fb;
  border-left: 3px solid #d8b85a;
}
.name span {
  display: block;
  font: 700 7px Arial, sans-serif;
  letter-spacing: .14em;
  color: #7b8593;
  text-transform: uppercase;
}
.name strong {
  display: block;
  margin-top: 4px;
  font-size: 16px;
  text-transform: uppercase;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
  border-top: 1px solid #d9e0e8;
  padding-top: 11px;
}
.row {
  display: grid;
  grid-template-columns: 105px 1fr;
  gap: 8px;
  padding: 5px 0;
  font-size: 11px;
  line-height: 1.45;
}
.row label {
  font: 700 7px Arial, sans-serif;
  color: #7b8593;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.admin-note {
  margin-top: 16px;
  padding: 9px 11px;
  border: 1px dashed #b9c5d3;
  background: #fbfcfd;
  font: 700 8px Arial, sans-serif;
  color: #667386;
  letter-spacing: .04em;
}
.signature {
  margin-top: 38px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 52px;
}
.line {
  border-top: 1px solid #172033;
  padding-top: 6px;
  text-align: center;
  font: 700 8px Arial, sans-serif;
  letter-spacing: .11em;
  text-transform: uppercase;
}
footer {
  margin-top: 20px;
  text-align: center;
  font: 400 7px Arial, sans-serif;
  color: #8a939f;
  letter-spacing: .07em;
}
</style>
</head>
<body>
<div class="sheet">
<header>
  <div class="diocese">${escapeHtml(institution.dioceseName)}</div>
  <div class="parish">${escapeHtml(institution.parishName)}</div>
  <div class="city">${escapeHtml(institution.city)}</div>
  <div class="kicker">Documento Complementario</div>
  <h1>Constancia de Exequias</h1>
</header>

<div class="control">
  <div><span>N.º Registro</span><strong>${escapeHtml(record.numero_registro || '—')}</strong></div>
  <div><span>Libro</span><strong>${escapeHtml(record.book_number || '—')}</strong></div>
  <div><span>Folio</span><strong>${escapeHtml(record.folio || '—')}</strong></div>
  <div><span>Número</span><strong>${escapeHtml(record.number || '—')}</strong></div>
</div>

<p class="statement">
La Parroquia hace constar que en su archivo eclesiástico se encuentra asentado el registro de Exequias correspondiente a:
</p>

<div class="name">
  <span>Fiel difunto</span>
  <strong>${escapeHtml(fullName)}</strong>
</div>

<div class="grid">
  <div>
    <div class="row"><label>Defunción</label><div>${escapeHtml(dateText(record.fecha_defuncion))}</div></div>
    <div class="row"><label>Lugar</label><div>${escapeHtml(record.lugar_defuncion || '—')}</div></div>
    <div class="row"><label>Exequias</label><div>${escapeHtml(dateText(record.fecha_exequias))}${funeralTime ? ' · ' + escapeHtml(funeralTime) : ''}</div></div>
  </div>
  <div>
    <div class="row"><label>Lugar Exequias</label><div>${escapeHtml(record.lugar_exequias || '—')}</div></div>
    <div class="row"><label>Cementerio</label><div>${escapeHtml(record.cementerio || '—')}</div></div>
    <div class="row"><label>Ministro</label><div>${escapeHtml(record.ministro || '—')}</div></div>
  </div>
</div>

<div class="admin-note">
CONTROL ADMINISTRATIVO: esta constancia es un documento complementario derivado del asiento parroquial.
El N.º de Registro es de control interno y no sustituye Libro, Folio y Número.
</div>

<div class="signature">
  <div class="line">PÁRROCO</div>
  <div class="line">FIRMA Y SELLO PARROQUIAL</div>
</div>

<footer>Documento generado desde SACRAMENTUM · Registro Eclesial</footer>
</div>
<script>window.onload=()=>{window.print();};</script>
</body>
</html>`);

    popup.document.close();
  };

  return (
    <DashboardLayout entityName={parishName}>
      <div className="mx-auto max-w-7xl pb-12">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4B7BA7] text-white shadow-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#4B7BA7]">
                  Archivo Parroquial
                </p>
                <h1 className="font-serif text-3xl font-black text-slate-950">Partidas de Exequias</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Consulte por nombre, Libro/Folio/Número o N.º de Registro interno.
            </p>
          </div>

          <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl">
            <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        <div className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar difunto, libro, folio, número o registro..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#4B7BA7] focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[340px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-[#4B7BA7]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center">
            <Cross className="mx-auto h-12 w-12 text-slate-200" />
            <p className="mt-4 text-sm font-black text-slate-700">No hay partidas que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    {['Difunto', 'Tipo', 'Libro', 'Folio', 'Número', 'Defunción', 'Exequias', 'Estado', ''].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-4">
                        <p className="text-[11px] font-black uppercase text-slate-900">
                          {row.nombres} {row.apellidos}
                        </p>
                        <p className="mt-1 font-mono text-[9px] text-slate-400">
                          REG. {row.numero_registro || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[9px] font-black uppercase text-slate-500">{labelStatus(row.book_type || 'ordinario', 'Ordinario')}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{row.book_number || '—'}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{row.folio || '—'}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{row.number || '—'}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{String(row.fecha_defuncion || '—').slice(0, 10)}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">{String(row.fecha_exequias || '—').slice(0, 10)}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-green-700">
                          Asentado
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printFuneralSlip(row)}
                            className="rounded-xl"
                          >
                            <Printer className="mr-1.5 h-4 w-4" /> Constancia
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRecord(row)}
                            className="rounded-xl"
                          >
                            <Eye className="mr-1.5 h-4 w-4" /> Ver
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#4B7BA7]">Partida de Exequias</p>
                  <h2 className="mt-1 text-lg font-black uppercase text-slate-950">
                    {selected.nombres} {selected.apellidos}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid gap-3 sm:grid-cols-5">
                  <Info label="Tipo" value={(selected.book_type || 'ordinario').toUpperCase()} />
                  <Info label="Libro" value={selected.book_number} />
                  <Info label="Folio" value={selected.folio} />
                  <Info label="Número" value={selected.number} />
                  <Info label="Registro interno" value={selected.numero_registro || '—'} />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Detail label="Fecha de defunción" value={dateText(selected.fecha_defuncion)} />
                  <Detail label="Lugar de defunción" value={selected.lugar_defuncion} />
                  <Detail label="Fecha de exequias" value={dateText(selected.fecha_exequias)} />
                  <Detail label="Lugar de exequias" value={selected.lugar_exequias} />
                  <Detail label="Cementerio" value={selected.cementerio} />
                  <Detail label="Ministro" value={selected.ministro} />
                  <Detail label="Padre" value={selected.nombre_padre} />
                  <Detail label="Madre" value={selected.nombre_madre} />
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Anotaciones marginales</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {loadingNotes ? 'Cargando...' : `${notes.length + (selected.nota_marginal ? 1 : 0)} anotación(es) disponible(s).`}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={printNotes}
                        onChange={(e) => setPrintNotes(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#4B7BA7]"
                      />
                      Incluir notas al imprimir
                    </label>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                    Documento complementario
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-700/80">
                    La Constancia de Exequias puede entregarse a la familia o utilizarse para trámites parroquiales.
                    Incluye el N.º de Registro interno como control administrativo; la Partida oficial continúa identificándose por Libro, Folio y Número.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => printFuneralSlip(selected)}
                    className="rounded-xl px-6"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Constancia
                  </Button>
                  <Button onClick={printCertificate} className="rounded-xl bg-[#4B7BA7] px-6">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Partida
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 font-mono text-[11px] font-black text-slate-800">{value || '—'}</p>
  </div>
);

const Detail = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-800">{value || '—'}</p>
  </div>
);

export default FuneralPartidasPage;
