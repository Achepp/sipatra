-- Migration: Buat tabel activity_logs untuk mencatat log aktivitas superadmin
-- Jalankan script ini di Supabase Dashboard SQL Editor (https://supabase.com)

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,                  -- Jenis aksi, misal: 'reset_password'
  performed_by TEXT,                     -- Nama superadmin yang melakukan
  performed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user TEXT,                      -- Nama pengguna yang menjadi target
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detail TEXT,                           -- Deskripsi lengkap aksi
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nonaktifkan RLS agar bisa diinsert dari frontend dengan anon key
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);
