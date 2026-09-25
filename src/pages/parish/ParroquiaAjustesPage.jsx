import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Database, ShieldCheck, Settings2 } from 'lucide-react';

const ParroquiaAjustesPage = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout entityName={user?.parishName || user?.parish_name || 'Parroquia'}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Ajustes de Parroquia</h1>
          <p className="text-slate-500 mt-1">
            Configuración operativa de la parroquia. Las importaciones ya no se ejecutan desde esta sección.
          </p>
        </div>

        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-[#4B7BA7] shadow-sm">
              <Database className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-900">Importaciones centralizadas</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Catálogos, registros históricos y bases legacy se importan exclusivamente desde el Centro de Migración.
                Allí se exige parroquia propietaria, staging, validación, auditoría y materialización controlada.
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-blue-700">
                La ejecución de migraciones corresponde a Administrador General o Diócesis/Arquidiócesis.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8">
          <div className="flex items-start gap-4">
            <Settings2 className="h-6 w-6 text-[#D4AF37]" />
            <div>
              <h2 className="text-lg font-black text-slate-900">Datos Auxiliares</h2>
              <p className="mt-2 text-sm text-slate-600">
                Diócesis, iglesias, ciudades, párrocos, obispos y demás auxiliares se consultan y mantienen manualmente
                desde Datos Auxiliares. La carga masiva de archivos queda separada de la edición cotidiana.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center gap-3 text-emerald-900">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm font-bold">
              Una importación nunca cambia la parroquia propietaria ni altera consecutivos sacramentales por sí sola.
            </p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default ParroquiaAjustesPage;
