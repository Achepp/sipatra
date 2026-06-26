-- 1. Reset tabel jika ada
DROP TABLE IF EXISTS session_expenses CASCADE;
DROP TABLE IF EXISTS session_attendees CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS pengaturan CASCADE;

-- 2. Tabel Members (Pengguna)
CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL, -- 'admin', 'member'
  status TEXT NOT NULL -- 'aktif', 'nonaktif'
);

-- 3. Tabel Sessions (Sesi Badminton)
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  nama_sesi TEXT NOT NULL,
  tanggal_main DATE NOT NULL,
  jam_main TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  catatan TEXT,
  status_tagihan TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'generated'
  biaya_per_orang INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Session Attendees (Kehadiran)
CREATE TABLE session_attendees (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_session_member UNIQUE (session_id, member_id)
);

-- 5. Tabel Session Expenses (Pengeluaran Sesi)
CREATE TABLE session_expenses (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  keterangan TEXT NOT NULL,
  nominal INTEGER NOT NULL,
  kategori TEXT NOT NULL, -- 'Sewa Lapangan', 'Peralatan', 'Konsumsi', 'Lainnya'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabel Payments (Pembayaran Sesi Hadir)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  nominal_tagihan INTEGER NOT NULL,
  status_pembayaran TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'uploaded', 'verified', 'rejected'
  tanggal_bayar TIMESTAMPTZ,
  bukti_transfer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_session_member_payment UNIQUE (session_id, member_id)
);

-- 7. Tabel Pengaturan
CREATE TABLE pengaturan (
  id SERIAL PRIMARY KEY,
  qris_image_url TEXT,
  nama_komunitas TEXT NOT NULL,
  rekening_penerima TEXT NOT NULL
);

-- 8. Seed Data Awal
-- Members
INSERT INTO members (name, email, role, status) VALUES
('Admin Bendahara', 'admin@sipatra.com', 'admin', 'aktif'),
('Budi Santoso', 'budi@dosen.com', 'member', 'aktif'),
('Andi Wijaya', 'andi@dosen.com', 'member', 'aktif'),
('Siti Aminah', 'siti@dosen.com', 'member', 'aktif');

-- Sesi Selesai (Tagihan Generated)
INSERT INTO sessions (id, nama_sesi, tanggal_main, jam_main, lokasi, catatan, status_tagihan, biaya_per_orang) VALUES
(1, 'Badminton Minggu Pagi', '2026-06-22', '08:00 - 10:00', 'GOR ABC', 'Sesi mingguan rutin', 'generated', 35000);

-- Sesi Draft Baru (Belum Generated Tagihan)
INSERT INTO sessions (id, nama_sesi, tanggal_main, jam_main, lokasi, catatan, status_tagihan, biaya_per_orang) VALUES
(2, 'Badminton Selasa Malam', '2026-06-24', '19:00 - 21:00', 'GOR Badminton Jaya', 'Sesi sparring internal', 'draft', 0);

SELECT setval('sessions_id_seq', (SELECT MAX(id) FROM sessions));

-- Kehadiran Sesi 1 (Hadir: Budi, Andi, Siti)
INSERT INTO session_attendees (session_id, member_id) VALUES
(1, 2), -- Budi
(1, 3), -- Andi
(1, 4); -- Siti

-- Kehadiran Sesi 2 (Hadir: Budi, Andi)
INSERT INTO session_attendees (session_id, member_id) VALUES
(2, 2), -- Budi
(2, 3); -- Andi

-- Pengeluaran Sesi 1 (Total: Rp105.000)
INSERT INTO session_expenses (session_id, keterangan, nominal, kategori) VALUES
(1, 'Sewa Lapangan (2 Jam)', 75000, 'Sewa Lapangan'),
(1, 'Kok Badminton (1/2 Slop)', 30000, 'Peralatan');

-- Pengeluaran Sesi 2 (Total: Rp180.000)
INSERT INTO session_expenses (session_id, keterangan, nominal, kategori) VALUES
(2, 'Sewa Lapangan', 100000, 'Sewa Lapangan'),
(2, 'Beli Kok 1 Slop', 80000, 'Peralatan');

-- Payments Sesi 1 (3 anggota hadir, masing-masing Rp35.000)
-- Budi: unpaid, Andi: uploaded, Siti: verified
INSERT INTO payments (session_id, member_id, nominal_tagihan, status_pembayaran, tanggal_bayar, bukti_transfer) VALUES
(1, 2, 35000, 'unpaid', null, null),
(1, 3, 35000, 'uploaded', '2026-06-22T01:00:00Z', 'https://via.placeholder.com/150'),
(1, 4, 35000, 'verified', '2026-06-22T00:30:00Z', 'https://via.placeholder.com/150');

-- Pengaturan
INSERT INTO pengaturan (qris_image_url, nama_komunitas, rekening_penerima) VALUES
('/qris.jpg', 'PB Sehat Sentosa', 'Mandiri 123-45678-90 a.n. Bendahara PB');

-- Disable RLS
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendees DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengaturan DISABLE ROW LEVEL SECURITY;

-- Storage bucket payment-proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public select on payment-proofs" ON storage.objects;
CREATE POLICY "Allow public select on payment-proofs" ON storage.objects FOR SELECT TO public USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Allow public insert on payment-proofs" ON storage.objects;
CREATE POLICY "Allow public insert on payment-proofs" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'payment-proofs');

-- Storage bucket avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public select on avatars" ON storage.objects;
CREATE POLICY "Allow public select on avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow public insert on avatars" ON storage.objects;
CREATE POLICY "Allow public insert on avatars" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow public update on avatars" ON storage.objects;
CREATE POLICY "Allow public update on avatars" ON storage.objects FOR UPDATE TO public WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow public delete on avatars" ON storage.objects;
CREATE POLICY "Allow public delete on avatars" ON storage.objects FOR DELETE TO public USING (bucket_id = 'avatars');

-- 9. Tambahkan kolom avatar_url ke tabel profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
