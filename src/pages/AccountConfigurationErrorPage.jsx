import React from 'react';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

const AccountConfigurationErrorPage = () => {
  const { configurationError, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 md:p-10 shadow-xl shadow-slate-900/5">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-6">
          <ShieldAlert className="w-7 h-7 text-amber-700" />
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#4B7BA7]">Sacramentum · Seguridad</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-slate-900">
          Configuración de cuenta incompleta
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          El acceso fue detenido porque no se pudo validar de forma segura la jurisdicción de esta cuenta. Ninguna parroquia o diócesis será asignada automáticamente.
        </p>

        {configurationError && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
            {configurationError}
          </div>
        )}

        <div className="mt-7 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-[#4B7BA7] mt-0.5" />
            <p>Solicita al administrador verificar el registro de <strong>user_profiles</strong>, el rol y la jurisdicción asignada a tu usuario.</p>
          </div>
        </div>

        <Button onClick={logout} className="mt-7 w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-wider text-xs">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión de forma segura
        </Button>
      </section>
    </main>
  );
};

export default AccountConfigurationErrorPage;
