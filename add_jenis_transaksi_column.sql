-- Migration: Tambahkan kolom jenis_transaksi ke tabel session_expenses
-- Jalankan script ini di Supabase Dashboard SQL Editor (https://supabase.com)

ALTER TABLE public.session_expenses 
ADD COLUMN IF NOT EXISTS jenis_transaksi TEXT CHECK (jenis_transaksi IN ('masuk', 'keluar'));

-- Migrasi data lama: Semua pengeluaran yang sudah ada default ke 'keluar'
UPDATE public.session_expenses 
SET jenis_transaksi = 'keluar' 
WHERE jenis_transaksi IS NULL;
