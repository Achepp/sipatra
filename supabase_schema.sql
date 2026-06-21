-- Reset database
DROP TABLE IF EXISTS transaksi;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS pengaturan;

-- 1. Tabel Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT NOT NULL
);

-- 2. Tabel Bills
CREATE TABLE bills (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  "dueDate" DATE NOT NULL,
  type TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Transaksi
CREATE TABLE transaksi (
  id SERIAL PRIMARY KEY,
  "billId" INTEGER REFERENCES bills(id) ON DELETE CASCADE,
  "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
  jenis_tagihan TEXT NOT NULL,
  nominal_tagihan INTEGER NOT NULL,
  status_pembayaran TEXT NOT NULL DEFAULT 'pending',
  tanggal_bayar TIMESTAMPTZ,
  bukti_transfer TEXT
);

-- 4. Tabel Expenses
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabel Pengaturan
CREATE TABLE pengaturan (
  id SERIAL PRIMARY KEY,
  qris_image_url TEXT,
  nama_komunitas TEXT NOT NULL,
  rekening_penerima TEXT NOT NULL
);

-- Seed Data Awal untuk Users (Demo login)
INSERT INTO users (name, email, role, status) VALUES
('Admin Bendahara', 'admin@sipatra.com', 'admin', 'aktif'),
('Budi Santoso', 'budi@dosen.com', 'member', 'aktif'),
('Andi Wijaya', 'andi@dosen.com', 'member', 'aktif'),
('Siti Aminah', 'siti@dosen.com', 'member', 'aktif');

-- Seed Data Awal untuk Bills
INSERT INTO bills (id, title, amount, "dueDate", type) VALUES
(1, 'Iuran Badminton Agustus', 50000, '2026-08-31', 'Bulanan'),
(2, 'Iuran Kok Tambahan', 20000, '2026-08-15', 'Insidental');

-- Adjust serial sequence for bills
SELECT setval('bills_id_seq', (SELECT MAX(id) FROM bills));

-- Seed Data Awal untuk Transaksi
INSERT INTO transaksi ("billId", "userId", jenis_tagihan, nominal_tagihan, status_pembayaran, tanggal_bayar, bukti_transfer) VALUES
(1, 2, 'Iuran Badminton Agustus', 50000, 'pending', null, null),
(1, 3, 'Iuran Badminton Agustus', 50000, 'uploaded', '2026-08-12T01:00:00Z', 'https://via.placeholder.com/150'),
(1, 4, 'Iuran Badminton Agustus', 50000, 'verified', '2026-08-05T01:00:00Z', 'https://via.placeholder.com/150'),
(2, 2, 'Iuran Kok Tambahan', 20000, 'pending', null, null);

-- Seed Data Awal untuk Expenses
INSERT INTO expenses (title, amount, category, date) VALUES
('Sewa Lapangan Agustus', 150000, 'Sewa', '2026-08-02T01:00:00Z'),
('Beli Shuttlecock (2 Slop)', 180000, 'Peralatan', '2026-08-05T01:00:00Z');

-- Seed Data Awal untuk Pengaturan
INSERT INTO pengaturan (qris_image_url, nama_komunitas, rekening_penerima) VALUES
('/qris.jpg', 'PB Sehat Sentosa', 'Mandiri 123-45678-90 a.n. Bendahara PB');

-- Disable RLS untuk kenyamanan demo lokal
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengaturan DISABLE ROW LEVEL SECURITY;

-- 6. Setup Supabase Storage Bucket & Policies secara otomatis
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public select on payment-proofs" ON storage.objects;
CREATE POLICY "Allow public select on payment-proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Allow public insert on payment-proofs" ON storage.objects;
CREATE POLICY "Allow public insert on payment-proofs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-proofs');
