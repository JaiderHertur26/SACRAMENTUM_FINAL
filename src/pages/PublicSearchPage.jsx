import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    Church, Lock, User, AlertCircle, Info, 
    ShieldCheck, ArrowLeft, KeyRound, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { getDashboardPathForRole } from '@/lib/authz';
import { BARRANQUILLA_CREST, BARRANQUILLA_NAME } from '@/lib/institutionalBranding';

const PublicSearchPage = () => {
  const { login } = useAuth();
  const { toast } = useToast();

  const [authView, setAuthView] = useState('login'); 
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [regData, setRegData] = useState({ token: '', fullName: '', email: '', password: '', confirmPassword: '' });
  const [forgotData, setForgotData] = useState({ username: '' });

  // =========================================================================
  // 🔐 LOGIN CON REDIRECCIÓN DE FUERZA BRUTA
  // =========================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    const result = await login(credentials.username.trim().toLowerCase(), credentials.password);

    if (result?.success) {
      toast({ title: "Acceso Concedido", description: "Iniciando panel...", variant: "success" });
      
      window.location.assign(getDashboardPathForRole(result.role));
    } else {
      setLoginError(result?.error || "Usuario o contraseña incorrectos");
      setLoginLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    const email = forgotData.username.trim().toLowerCase();
    if (!email) return;

    setForgotLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setForgotData({ username: '' });
      setAuthView('login');
      toast({
        title: "Solicitud procesada",
        description: "Si el correo pertenece a una cuenta activa, recibirá un enlace seguro para restablecer la contraseña.",
        duration: 6000
      });
    } catch (error) {
      console.warn('No fue posible iniciar la recuperación de contraseña:', error);
      toast({
        title: "No se pudo enviar el enlace",
        description: "Verifica la dirección de correo o inténtalo nuevamente.",
        variant: "destructive"
      });
    } finally {
      setForgotLoading(false);
    }
  };

  // =========================================================================
  // 🚀 ACTIVACIÓN DE ENTORNOS (BLINDADO CON SUPABASE AUTH)
  // =========================================================================
  const handleRegister = async (e) => {
    e.preventDefault();
    if (regData.password !== regData.confirmPassword) {
      toast({ title: "Validación", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }

    setRegLoading(true);
    try {
      const tokenToFind = regData.token.trim();
      const emailToSave = regData.email.trim().toLowerCase();
      const fullNameToSave = regData.fullName.trim();

      if (!tokenToFind || !fullNameToSave || !emailToSave) throw new Error('Código de activación, nombre completo y correo son obligatorios.');
      if (regData.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

      // La activación pública nunca lee pending_tokens ni crea perfiles desde el navegador.
      // La Edge Function reclama el token atómicamente y usa service role sólo en servidor.
      const { data: activationData, error: activationError } = await supabase.functions.invoke('activate-environment', {
        body: { token: tokenToFind, fullName: fullNameToSave, email: emailToSave, password: regData.password }
      });

      if (activationError) throw activationError;
      if (!activationData?.success) throw new Error(activationData?.error || 'No se pudo completar la activación segura.');

      const autoLoginResult = await login(emailToSave, regData.password);
      if (autoLoginResult?.success) {
        window.location.assign(getDashboardPathForRole(autoLoginResult.role));
        return;
      }

      setAuthView('login');
      toast({ title: 'Entorno activado', description: 'Inicia sesión con las nuevas credenciales.' });
    } catch (err) {
      let message = String(err?.message || 'No fue posible completar la activación.');
      try {
        if (err?.context?.clone) {
          const body = await err.context.clone().json();
          if (body?.error) message = String(body.error);
        }
      } catch (_) {
        // Si la respuesta no contiene JSON, conservamos el mensaje original.
      }
      toast({
        title: 'Fallo en Activación',
        description: message.includes('FunctionsHttpError')
          ? 'La activación segura del servidor no está disponible. Verifica el despliegue de la Edge Function activate-environment.'
          : message,
        variant: 'destructive'
      });
    } finally {
      setRegLoading(false);
    }
  };

  // --- RENDERIZADORES DE UI ---
  const renderLogin = () => (
    <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-[#2d5278] uppercase tracking-widest ml-1">Email Registrado</label>
            <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                <input type="email" required value={credentials.username} onChange={e => setCredentials({...credentials, username: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-white/65 border border-[#bad3e9] rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-[#4B7BA7] transition-all font-bold text-slate-700 shadow-[0_1px_4px_rgba(31,61,91,0.04)]" placeholder="admin@ejemplo.com" />
            </div>
        </div>
        <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-extrabold text-[#2d5278] uppercase tracking-widest">Contraseña</label>
                <button type="button" onClick={() => setAuthView('forgot')} className="text-[9px] font-bold text-blue-600 hover:underline uppercase tracking-tighter">¿Olvidó su clave?</button>
            </div>
            <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#4B7BA7] transition-colors" />
                <input type="password" required value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-white/65 border border-[#bad3e9] rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-[#4B7BA7] transition-all font-bold shadow-[0_1px_4px_rgba(31,61,91,0.04)]" placeholder="••••••••" />
            </div>
        </div>
        {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold flex items-center gap-2 border border-red-100 uppercase tracking-tight"><AlertCircle className="w-4 h-4" /> {loginError}</div>}
        <Button disabled={loginLoading} className="w-full py-7 rounded-2xl bg-gradient-to-r from-[#e7b820] via-[#D4AF37] to-[#bd9220] hover:shadow-xl shadow-amber-800/10 text-white font-black uppercase tracking-widest text-xs transition-all transform active:scale-95 border border-[#b78a27]/30">
            {loginLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Iniciar Sesión'}
        </Button>
        <div className="text-center pt-5 border-t border-[#b3c8dc]/35">
            <button type="button" onClick={() => setAuthView('register')} className="text-[10px] font-black text-[#4B7BA7] uppercase tracking-widest hover:underline">¿Primer acceso? Activa tu cuenta</button>
        </div>
    </motion.form>
  );

  const renderRegister = () => (
    <motion.form key="reg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleRegister} className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 mb-2 text-blue-800 text-[10px] font-bold uppercase leading-tight">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            Usa el código de activación para habilitar tu despacho. El email que coloques será tu nuevo usuario.
        </div>
        <input type="text" required placeholder="CÓDIGO DE ACTIVACIÓN" value={regData.token} onChange={e => setRegData({...regData, token: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <input type="text" required placeholder="NOMBRE COMPLETO DEL RESPONSABLE" value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-2xl text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <input type="email" required placeholder="NUEVO EMAIL DE ACCESO" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-2xl text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <div className="grid grid-cols-2 gap-3">
            <input type="password" required placeholder="CLAVE" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-[#D4AF37]" />
            <input type="password" required placeholder="REPETIR" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        </div>
        <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => setAuthView('login')} variant="ghost" className="rounded-2xl px-4 font-black uppercase text-[10px]"><ArrowLeft className="w-5 h-5"/></Button>
            <Button disabled={regLoading} className="flex-1 py-7 rounded-2xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase tracking-widest text-[10px]">
                {regLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Activar Entorno'}
            </Button>
        </div>
    </motion.form>
  );

  const renderForgot = () => (
    <motion.form key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleForgot} className="space-y-4 text-center">
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 inline-block mb-4"><KeyRound className="w-8 h-8 text-amber-600" /></div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Recuperar Acceso</h3>
        <p className="text-[11px] text-slate-400 uppercase font-bold tracking-tight mb-4">Ingresa tu email para recibir un enlace seguro.</p>
        <input type="email" required placeholder="EMAIL REGISTRADO" value={forgotData.username} onChange={e => setForgotData({username: e.target.value})} className="w-full px-4 py-4 bg-slate-50 rounded-2xl text-xs font-black tracking-widest outline-none focus:ring-2 focus:ring-[#D4AF37]" />
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex gap-2 text-left">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-600"><strong>¿Problemas de acceso?</strong> Su superior jerárquico puede verificar que la cuenta esté activa y que el correo registrado sea correcto.</p>
        </div>
        <Button disabled={forgotLoading} className="w-full py-7 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px]">{forgotLoading ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'Enviar Instrucciones'}</Button>
        <button type="button" onClick={() => setAuthView('login')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline mt-4 block mx-auto">Volver al inicio</button>
    </motion.form>
  );

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#1c2c3c] flex flex-col lg:flex-row lg:overflow-hidden font-sans relative">
      <div className="pointer-events-none absolute z-40 left-0 top-0 h-[3px] w-full bg-gradient-to-r from-[#dfb34d] via-[#e9c45d] to-[#9d7b2d]" aria-hidden="true" />
      <Helmet><title>Acceso Seguro · SACRAMENTUM</title></Helmet>

      {/* PANEL LATERAL (LOGIN) */}
      <aside className="w-full lg:w-[450px] bg-gradient-to-br from-[#fffdf9] via-[#f8fbff] to-[#eaf2fa] lg:border-r border-b lg:border-b-0 border-[#d9cba5] flex flex-col p-8 lg:p-10 shadow-2xl relative z-20 shrink-0 lg:overflow-y-auto overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="pointer-events-none absolute -top-20 -left-28 w-[520px] h-[560px] rounded-[50%] border border-[#d4af37]/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-28 -left-20 w-[520px] h-[610px] rounded-[50%] border border-[#d4af37]/10" aria-hidden="true" />
        <Church className="pointer-events-none absolute -bottom-16 -left-24 w-48 h-48 text-[#395d7c]/[0.035]" aria-hidden="true" />
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-10">
            <div className="text-center mb-10">
                <div className="bg-[#4B7BA7] w-16 h-16 rounded-3xl rotate-12 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-900/20">
                    <Church className="w-8 h-8 text-white -rotate-12" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Sacramentum</h2>
                <p className="text-[10px] font-extrabold text-[#527ea6] uppercase tracking-[0.25em] mt-2 italic">Sistema Eclesial de Registro Sacramental</p>
                {import.meta.env.VITE_REGISTRY_DATA_MODE !== 'official' && (
                  <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-950">DATOS DE PRUEBA · NO OFICIALES</p>
                )}
                <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true"><span className="h-px w-20 bg-[#d4af37]/70"/><span className="h-2 w-2 rotate-45 border border-[#d4af37]"/><span className="h-px w-20 bg-[#d4af37]/70"/></div>
            </div>
            <AnimatePresence mode="wait">
                {authView === 'login' ? renderLogin() : authView === 'register' ? renderRegister() : renderForgot()}
            </AnimatePresence>
        </div>
        <div className="relative z-10 pt-6 lg:pt-10 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[#89a3bf]">
            <ShieldCheck className="w-4 h-4" /> Sesión protegida · Supabase Auth
        </div>
      </aside>

      {/* PANEL PRINCIPAL (PORTADA INSTITUCIONAL) */}
      <main className="relative flex flex-1 w-full min-h-[360px] lg:min-h-0 lg:h-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_38%_36%,#28455e_0%,#1b3044_52%,#142536_100%)] p-6 sm:p-10 lg:p-12" aria-label="Presentación institucional de la Arquidiócesis de Barranquilla">
          <Church className="pointer-events-none absolute -bottom-24 -right-28 h-[570px] w-[570px] rotate-12 text-[#c8d3db]/[0.045]" aria-hidden="true" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10 flex max-w-lg w-full flex-col items-center text-center">
            <div className="relative flex w-full max-w-[380px] flex-col items-center rounded-t-[11rem] border-x border-t border-[#d4af37]/45 px-6 pt-8 pb-8 lg:px-10 lg:pt-10">
              <span className="pointer-events-none absolute top-[44%] -left-1 h-2 w-2 rotate-45 bg-[#d4af37]" aria-hidden="true" />
              <span className="pointer-events-none absolute top-[44%] -right-1 h-2 w-2 rotate-45 bg-[#d4af37]" aria-hidden="true" />
              <img src={BARRANQUILLA_CREST} alt="Escudo de la Arquidiócesis de Barranquilla" className="h-48 sm:h-56 lg:h-[310px] w-auto object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.2)]" />
              <h1 className="mt-4 text-[clamp(1.6rem,3vw,2.8rem)] font-light leading-[1.13] tracking-tight text-[#ebc66d]">
                Arquidiócesis<br />de Barranquilla
              </h1>
              <div className="mt-7 flex w-full items-center justify-center gap-3 text-[#d4af37]" aria-hidden="true">
                <span className="h-px w-20 bg-gradient-to-r from-transparent to-[#d4af37]" />
                <span className="h-2 w-2 rotate-45 border border-[#d4af37]" />
                <span className="h-px w-20 bg-gradient-to-l from-transparent to-[#d4af37]" />
              </div>
            </div>
          </motion.div>
      </main>
    </div>
  );
};

// Puedes cambiarle el nombre interno o dejarlo así si en tu App.jsx está importado como PublicSearchPage
export default PublicSearchPage;