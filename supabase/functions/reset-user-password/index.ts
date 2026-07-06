// supabase/functions/reset-user-password/index.ts
// Edge Function: Reset User Password
// Dipanggil dari frontend (superadmin only).
// Service role key disimpan aman di Supabase secrets, tidak di-expose ke browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS: Allow any origin — fungsi ini sudah diamankan oleh JWT + superadmin role check server-side.
// Tidak perlu whitelist origin karena keamanan tidak bergantung pada CORS.
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Ambil service role key dari Supabase secrets (AMAN — tidak pernah ke browser)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[reset-user-password] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verifikasi JWT caller (harus user yang sedang login)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client untuk verifikasi user caller menggunakan JWT-nya
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const callerClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 3. Ambil data caller dari JWT
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      console.error('[reset-user-password] Caller auth error:', callerErr);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Buat admin client menggunakan service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 5. Verifikasi caller adalah superadmin via tabel profiles (server-side, tidak bisa dimanipulasi client)
    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileErr || !callerProfile) {
      console.error('[reset-user-password] Profile fetch error:', profileErr);
      return new Response(
        JSON.stringify({ error: 'Gagal memverifikasi role pengguna' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.role !== 'superadmin') {
      console.warn('[reset-user-password] Access denied. Caller role:', callerProfile.role);
      return new Response(
        JSON.stringify({ error: 'Akses Ditolak: Hanya Superadmin yang dapat mereset password.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Ambil userId dari request body
    const body = await req.json();
    const { userId, userName } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Parameter userId diperlukan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reset-user-password] Resetting password for userId: ${userId} (${userName ?? 'unknown'})`);

    // 7. Panggil Admin API dengan service role key (AMAN — berjalan di server Supabase)
    //    Reset password DAN set user_metadata.password_changed = false
    //    agar sistem mendeteksi password masih default dan memaksa user ganti saat login berikutnya
    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password: 'sisteminformasi',
      user_metadata: { password_changed: false },
    });

    // Log di server (hanya terlihat di Supabase Edge Function logs, tidak di browser)
    console.log('[reset-user-password] updateUserById data:', JSON.stringify(data));
    console.log('[reset-user-password] updateUserById error:', JSON.stringify(error));

    if (error) {
      console.error('[reset-user-password] FAILED to update password:', error.message, error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Gagal mereset password',
          code: (error as any).code ?? null,
          status: (error as any).status ?? null,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Log aktivitas (best-effort, tidak memblokir response)
    try {
      await adminClient.from('activity_logs').insert({
        action: 'reset_password',
        performed_by: callerUser.email ?? 'Superadmin',
        performed_by_id: callerUser.id,
        target_user: userName ?? userId,
        target_user_id: userId,
        detail: `Password direset ke "sisteminformasi" oleh superadmin via Edge Function`,
        created_at: new Date().toISOString(),
      });
    } catch (logErr: any) {
      console.warn('[reset-user-password] Activity log gagal:', logErr?.message);
    }

    console.log('[reset-user-password] SUCCESS: Password updated for userId:', userId);

    return new Response(
      JSON.stringify({ success: true, userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[reset-user-password] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
