-- ============================================================
-- FIX: Tambah kolom yang dibutuhkan untuk membuat sesi baru
-- Jalankan script ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tambahkan kolom biaya_lapangan jika belum ada
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS biaya_lapangan INTEGER DEFAULT 0;

-- 2. Tambahkan kolom kas_wajib_per_orang jika belum ada
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS kas_wajib_per_orang INTEGER DEFAULT 5000;

-- 3. Tambahkan kolom jenis_transaksi ke session_expenses jika belum ada
ALTER TABLE public.session_expenses 
ADD COLUMN IF NOT EXISTS jenis_transaksi TEXT CHECK (jenis_transaksi IN ('masuk', 'keluar'));

-- 4. Set default jenis_transaksi untuk data lama yang belum ada nilainya
UPDATE public.session_expenses 
SET jenis_transaksi = 'keluar' 
WHERE jenis_transaksi IS NULL;

-- 5. Pastikan sessions table tidak ada RLS yang menghalangi INSERT
-- (Uncomment baris di bawah jika masih gagal setelah langkah 1-4)
-- ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.session_expenses DISABLE ROW LEVEL SECURITY;

-- Verifikasi: Cek struktur tabel sessions setelah migration
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND table_schema = 'public'
ORDER BY ordinal_position;
