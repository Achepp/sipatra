import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yatsujlrfyvtrxudvcnu.supabase.co';
const supabaseKey = 'sb_publishable_3qqlUxv9_ZgYT40f_bqbfg_cNvkM8VH';
const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL = 'dosen03140@unpam.ac.id';
const DEFAULT_PASSWORD = 'sisteminformasi';

async function run() {
  console.log(`\n🔍 Mengecek user: ${EMAIL}\n`);

  // 1. Coba login dengan password default
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: DEFAULT_PASSWORD
  });

  if (error) {
    console.log('❌ Login dengan password default GAGAL');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('Invalid login credentials')) {
      console.log('\n📌 Kemungkinan:');
      console.log('   1. User SUDAH GANTI PASSWORD (bukan lagi "sisteminformasi")');
      console.log('   2. Atau akun belum terdaftar sama sekali');
    }
    return;
  }

  // Login berhasil = masih pakai password default
  console.log('✅ Login dengan password default BERHASIL');
  console.log('⚠️  User BELUM GANTI PASSWORD (masih pakai "sisteminformasi")\n');
  
  // Tampilkan info user
  const user = data.user;
  console.log('📋 Info User:');
  console.log(`   User ID  : ${user.id}`);
  console.log(`   Email    : ${user.email}`);
  console.log(`   Created  : ${user.created_at}`);
  console.log(`   Metadata : ${JSON.stringify(user.user_metadata, null, 2)}`);

  // 2. Cek data di tabel members
  const { data: member, error: mErr } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (mErr) {
    console.log(`\n❌ Gagal query tabel members: ${mErr.message}`);
  } else if (member) {
    console.log('\n📋 Data Member:');
    console.log(`   ID       : ${member.id}`);
    console.log(`   Nama     : ${member.name}`);
    console.log(`   Email    : ${member.email}`);
    console.log(`   Role     : ${member.role}`);
    console.log(`   Status   : ${member.status}`);
    if (member.status === 'nonaktif') {
      console.log('\n🚫 STATUS NONAKTIF — ini penyebab user tidak bisa login!');
    }
  } else {
    console.log('\n⚠️  Tidak ada data di tabel members untuk user ini');
  }

  // 3. Cek data di tabel profiles
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (pErr) {
    console.log(`\n❌ Gagal query tabel profiles: ${pErr.message}`);
  } else if (profile) {
    console.log('\n📋 Data Profile:');
    console.log(`   Nama     : ${profile.nama}`);
    console.log(`   Role     : ${profile.role}`);
    console.log(`   Nomor HP : ${profile.nomor_hp || '-'}`);
  } else {
    console.log('\n⚠️  Tidak ada data di tabel profiles untuk user ini');
  }

  // Sign out setelah selesai
  await supabase.auth.signOut();
  console.log('\n✅ Selesai. (signed out)\n');
}

run();
