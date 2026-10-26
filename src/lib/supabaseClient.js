import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuración incompleta: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno de despliegue.'
  );
}

// Explicit, stable key allows a failed remote logout to clear local credentials.
export const AUTH_STORAGE_KEY = 'sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
