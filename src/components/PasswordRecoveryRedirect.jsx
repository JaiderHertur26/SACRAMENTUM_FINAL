import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
// Older recovery emails may still redirect to the home page.
const recoveryAtLoad = typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
export default function PasswordRecoveryRedirect() {
  useEffect(() => {
    const redirect = () => {
      if (window.location.pathname !== '/reset-password') window.location.replace('/reset-password');
    };
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setTimeout(redirect, 0);
    });
    if (recoveryAtLoad) {
      // Let the SDK finish exchanging the URL before removing its fragment.
      void supabase.auth.getSession().then(({ data }) => { if (data.session) redirect(); });
    }
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
