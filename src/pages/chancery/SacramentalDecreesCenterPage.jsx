import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import DecreeCenterHeader, { decreeRouteFor } from '@/components/chancery/DecreeCenterHeader';
import { Church, HeartHandshake, Heart, ScrollText, FileCheck2, ArchiveRestore, History, ArrowRight } from 'lucide-react';

const SACRAMENTS = [
  { key: 'bautismo', label: 'Bautismo', icon: Church, description: 'Partidas bautismales y libro supletorio.' },
  { key: 'confirmacion', label: 'Confirmación', icon: HeartHandshake, description: 'Corrección y reposición de Confirmaciones.' },
  { key: 'matrimonio', label: 'Matrimonio', icon: Heart, description: 'Gobierno registral matrimonial. La nulidad no se tramita aquí.' },
  { key: 'exequias', label: 'Exequias', icon: ScrollText, description: 'Registros de Exequias y reconstrucción documental.' }
];

const OPERATIONS = [
  { key: 'correction', label: 'Corrección', icon: FileCheck2, text: 'Existe una partida con error: se anula la original y se crea una nueva partida supletoria.' },
  { key: 'reposition', label: 'Reposición', icon: ArchiveRestore, text: 'No existe partida utilizable, pero existe evidencia suficiente de que el sacramento o las Exequias sí ocurrieron.' },
  { key: 'archive', label: 'Archivo', icon: History, text: 'Consulta, impresión, trazabilidad y reversión auditada de decretos.' }
];

const SacramentalDecreesCenterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader />

        <section className="grid gap-5 lg:grid-cols-3">
          {OPERATIONS.map((operation) => {
            const Icon = operation.icon;
            return (
              <article key={operation.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-black text-slate-950">{operation.label}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{operation.text}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-600">Matriz de actuación</p>
            <h2 className="mt-1 font-serif text-2xl font-black text-slate-950">Seleccione el sacramento y la operación</h2>
            <p className="mt-1 text-xs text-slate-500">Los cuatro módulos comparten la misma arquitectura institucional de Cancillería.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SACRAMENTS.map((sacrament) => {
              const Icon = sacrament.icon;
              return (
                <article key={sacrament.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{sacrament.label}</h3>
                      <p className="mt-1 text-xs text-slate-500">{sacrament.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {OPERATIONS.map((operation) => (
                      <button
                        key={operation.key}
                        type="button"
                        onClick={() => navigate(decreeRouteFor(operation.key, sacrament.key))}
                        className="group rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-700 group-hover:text-blue-800">{operation.label}</span>
                        <ArrowRight className="mt-2 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-900">
            <strong>Nulidad matrimonial:</strong> no pertenece a Cancillería ni a este Centro de Decretos. Su declaración corresponde al Tribunal Eclesiástico. SACRAMENTUM conserva únicamente la infraestructura histórica bloqueada hasta construir ese módulo especializado.
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SacramentalDecreesCenterPage;
