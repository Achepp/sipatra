import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// CATATAN KEAMANAN: supabaseAdmin dihapus.
// Admin API (auth.admin.updateUserById dll) sekarang dipanggil via Supabase Edge Function.
// Service role key TIDAK boleh diekspos ke frontend (VITE_*).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
