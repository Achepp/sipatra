-- Migration: Perbarui konsep keuangan SI-PATRA agar lebih sederhana dan konsisten.
-- Jalankan script ini di Supabase Dashboard SQL Editor (https://supabase.com)

-- 1. Tambahkan kolom biaya_lapangan dan kas_wajib_per_orang ke tabel sessions jika belum ada
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS biaya_lapangan INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS kas_wajib_per_orang INTEGER DEFAULT 5000;

-- 2. Migrasikan data sessions yang sudah ada:
-- Set biaya_lapangan dari pengeluaran 'Sewa Lapangan' yang terkait
UPDATE public.sessions s
SET biaya_lapangan = COALESCE(
  (SELECT SUM(nominal) 
   FROM public.session_expenses e 
   WHERE e.session_id = s.id AND e.kategori = 'Sewa Lapangan'), 
  0
);

-- Set default kas_wajib_per_orang ke 5000 untuk data lama
UPDATE public.sessions
SET kas_wajib_per_orang = 5000
WHERE kas_wajib_per_orang IS NULL;

-- 3. Bersihkan/Migrasikan data session_expenses lama:
-- Ubah pengeluaran non-'Sewa Lapangan' yang menempel di sesi menjadi Pengeluaran Kas Organisasi umum (session_id = NULL)
UPDATE public.session_expenses
SET session_id = NULL,
    jenis_transaksi = 'keluar'
WHERE session_id IS NOT NULL 
  AND kategori != 'Sewa Lapangan';

-- Pastikan semua pengeluaran sewa lapangan memiliki jenis_transaksi = 'keluar'
UPDATE public.session_expenses
SET jenis_transaksi = 'keluar'
WHERE session_id IS NOT NULL
  AND kategori = 'Sewa Lapangan';
