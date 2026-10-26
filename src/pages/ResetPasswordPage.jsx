import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, AUTH_STORAGE_KEY } from '@/lib/supabaseClient';
import { completePasswordResetWithClient, validateNewPassword } from '@/services/passwordRecoveryService';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (alive) setStatus(!error && data?.user?.id ? 'ready' : 'invalid');
    }).catch(() => { if (alive) setStatus('invalid'); });
    return () => { alive = false; };
  }, []);
  const submit = async event => {
    event.preventDefault();
    if (busy.current || status !== 'ready') return;
    const validation = validateNewPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await completePasswordResetWithClient(supabase, password, confirmation);
      setPassword('');
      setConfirmation('');
      setStatus('complete');
      let reload = false;
      try {
        const result = await supabase.auth.signOut({ scope: 'local' });
        reload = !!result.error;
      } catch { reload = true; } finally {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_STORAGE_KEY + '-code-verifier');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sacraments_user_profile');
        if (reload) window.location.assign('/');
      }
    } catch (failure) {
      if (status !== 'complete') setError(failure?.message || 'No fue posible cambiar la contraseña. Inténtalo de nuevo.');
    } finally { busy.current = false; setSaving(false); }
  };
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl space-y-5" aria-labelledby="reset-title">
      <p className="text-sm font-bold tracking-widest text-sky-800">SACRAMENTUM</p>
      <h1 id="reset-title" className="text-2xl font-bold text-slate-900">Restablecer contraseña</h1>
      {status === 'checking' && <p role="status">Validando enlace seguro...</p>}
      {status === 'invalid' && <p role="alert">El enlace no es válido o ha caducado. Solicita otro desde la pantalla de acceso.</p>}
      {status === 'complete' && <p role="status">Contraseña actualizada. Inicia sesión con tu contraseña nueva.</p>}
      {status === 'ready' && <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Elige una contraseña de al menos 8 caracteres.</p>
        <label className="block font-medium" htmlFor="new-password">Contraseña nueva</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required disabled={saving} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border p-3" />
        <label className="block font-medium" htmlFor="confirm-password">Repetir contraseña</label>
        <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required disabled={saving} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full rounded-lg border p-3" />
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-sky-800 px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar contraseña'}</button>
      </form>}
      <Link to="/" className="inline-block font-medium text-sky-800 underline">Volver al acceso</Link>
    </section>
  </main>;
}