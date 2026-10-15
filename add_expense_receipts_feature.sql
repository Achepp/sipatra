-- ==============================================================================
-- MIGRATION: Fitur Upload Bukti Transaksi pada Pengeluaran Kas (SI-PATRA)
-- Khusus Role Bendahara
--
-- Jalankan script ini di Supabase Dashboard -> SQL Editor (https://supabase.com)
-- ==============================================================================

-- 1. Tambahkan kolom metadata bukti transaksi ke tabel session_expenses jika belum ada
ALTER TABLE public.session_expenses 
ADD COLUMN IF NOT EXISTS receipt_path TEXT,
ADD COLUMN IF NOT EXISTS receipt_file_name TEXT,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;

-- 2. Buat bucket storage 'expense-receipts' sebagai PRIVATE bucket (bukan public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880, -- Maksimal 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

-- 3. STORAGE POLICIES: Role-based Authorization untuk bucket 'expense-receipts'

-- Kebijakan SELECT / READ (Membuat signed URL & download bukti):
-- Hanya Bendahara (role = 'admin') dan Superadmin yang memiliki hak akses
DROP POLICY IF EXISTS "Allow bendahara select expense receipts" ON storage.objects;
CREATE POLICY "Allow bendahara select expense receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
);

-- Kebijakan INSERT / UPLOAD:
-- Hanya Bendahara (role = 'admin') dan Superadmin yang dapat upload bukti transaksi
DROP POLICY IF EXISTS "Allow bendahara insert expense receipts" ON storage.objects;
CREATE POLICY "Allow bendahara insert expense receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
);

-- Kebijakan UPDATE / REPLACE:
-- Hanya Bendahara (role = 'admin') dan Superadmin yang dapat mengganti bukti
DROP POLICY IF EXISTS "Allow bendahara update expense receipts" ON storage.objects;
CREATE POLICY "Allow bendahara update expense receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
);

-- Kebijakan DELETE:
-- Hanya Bendahara (role = 'admin') dan Superadmin yang dapat menghapus file bukti
DROP POLICY IF EXISTS "Allow bendahara delete expense receipts" ON storage.objects;
CREATE POLICY "Allow bendahara delete expense receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
);
