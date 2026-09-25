import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import DecreeCenterHeader, {
  DECREE_OPERATION_META,
  DECREE_SACRAMENT_META,
  decreeRouteFor
} from '@/components/chancery/DecreeCenterHeader';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

const ParishSacramentalDecreesCenterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout entityName={user?.parishName || 'Parroquia'}>
      <div className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader scope="parish" />

        <section className="grid gap-5 lg:grid-cols-3">
          {Object.entries(DECREE_OPERATION_META).map(([key, operation]) => {
            const Icon = operation.icon;
            const parishText = key === 'correction'
              ? 'Consulta las correcciones emitidas por Cancillería para partidas de esta parroquia.'
              : key === 'reposition'
                ? 'Consulta las reposiciones autorizadas por Cancillería cuando no existía una partida utilizable.'
                : 'Consulta el archivo completo, impresión y trazabilidad de los decretos recibidos.';

            return (
              <article key={key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-black text-slate-950">{operation.label}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{parishText}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-600">
              Archivo parroquial de decretos
            </p>
            <h2 className="mt-1 font-serif text-2xl font-black text-slate-950">
              Seleccione el sacramento y la operación
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              La Parroquia consulta los decretos emitidos por Cancillería con la misma clasificación
              institucional usada en el Centro Diocesano: Corrección, Reposición y Archivo.
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
                        onClick={() => navigate(decreeRouteFor(mode, sacramentKey, 'parish'))}
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
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-900">Mismo lenguaje institucional</h3>
                <p className="mt-2 text-xs leading-relaxed text-blue-800">
                  Corrección significa que existe una partida con error y se conserva la relación entre
                  la original anulada y la nueva partida supletoria. Reposición significa que no existe una
                  partida utilizable y se reconstruye el asiento con fundamento documental suficiente.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-900">Competencia de Cancillería</h3>
                <p className="mt-2 text-xs leading-relaxed text-amber-800">
                  La Parroquia recibe y consulta. La emisión y la reversión jurídica de decretos permanecen
                  exclusivamente en Cancillería, conforme al modelo de permisos de SACRAMENTUM.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default ParishSacramentalDecreesCenterPage;
