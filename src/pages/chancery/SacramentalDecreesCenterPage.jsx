import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import DecreeCenterHeader, {
  DECREE_OPERATION_META,
  DECREE_SACRAMENT_META,
  decreeRouteFor
} from '@/components/chancery/DecreeCenterHeader';
import { ArrowRight, FileText, History } from 'lucide-react';

const SacramentalDecreesCenterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader />

        <section className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => navigate('/chancery/decretos/documental')}
            className="flex items-start gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-400 hover:bg-blue-100">
            <FileText className="mt-1 h-6 w-6 shrink-0 text-blue-700" />
            <span><strong className="block font-serif text-lg text-slate-950">Decreto documental nuevo</strong>
              <small className="mt-2 block leading-relaxed text-slate-700">Expedir un acto de Cancillería sin alterar partidas ni notas marginales.</small></span>
          </button>
          <button type="button" onClick={() => navigate('/chancery/decretos/documental?mode=historico')}
            className="flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-left transition hover:border-amber-400 hover:bg-amber-100">
            <History className="mt-1 h-6 w-6 shrink-0 text-amber-700" />
            <span><strong className="block font-serif text-lg text-slate-950">Recuperar decreto antiguo</strong>
              <small className="mt-2 block leading-relaxed text-slate-700">Archivar su antecedente con fuente verificable, sin repetir efectos ya ocurridos.</small></span>
          </button>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {Object.entries(DECREE_OPERATION_META).map(([key, operation]) => {
            const Icon = operation.icon;
            const text = key === 'archive'
              ? 'Consulta, impresión, trazabilidad y reversión auditada de decretos emitidos.'
              : operation.subtitle;

            return (
              <article key={key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-black text-slate-950">{operation.label}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-600">
              Matriz de actuación
            </p>
            <h2 className="mt-1 font-serif text-2xl font-black text-slate-950">
              Seleccione el sacramento y la operación
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Los cuatro módulos comparten el mismo lenguaje institucional y la misma arquitectura documental.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(DECREE_SACRAMENT_META).map(([sacramentKey, sacrament]) => {
              const Icon = sacrament.icon;
              return (
                <article key={sacramentKey} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                        {sacrament.label}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{sacrament.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {Object.entries(DECREE_OPERATION_META).map(([mode, operation]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => navigate(decreeRouteFor(mode, sacramentKey, 'chancery'))}
                        className="group rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-700 group-hover:text-blue-800">
                          {operation.label}
                        </span>
                        <ArrowRight className="mt-2 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-900">
            <strong>Nulidad matrimonial:</strong> no forma parte de Corrección ni Reposición. Su declaración corresponde al Tribunal Eclesiástico.
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SacramentalDecreesCenterPage;
