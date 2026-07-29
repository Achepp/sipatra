// Script: cari member Agung & cek tagihan orphan-nya
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yatsujlrfyvtrxudvcnu.supabase.co',
  'sb_publishable_3qqlUxv9_ZgYT40f_bqbfg_cNvkM8VH'
);

async function run() {
  // 1. Cari semua member yang namanya mengandung "agung" (case-insensitive)
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .ilike('name', '%agung%');

  console.log(`\n🔍 Member dengan nama "Agung": ${members?.length ?? 0} ditemukan`);
  members?.forEach(m => console.log(`   ID: ${m.id} | Nama: ${m.name} | Email: ${m.email} | Role: ${m.role} | Status: ${m.status}`));

  if (!members || members.length === 0) {
    // Tampilkan semua member untuk referensi
    const { data: allMembers } = await supabase.from('members').select('id, name, email, role, status').order('id');
    console.log('\n📋 Semua member yang terdaftar:');
    allMembers?.forEach(m => console.log(`   ID: ${m.id} | Nama: ${m.name} | Email: ${m.email}`));
    return;
  }

  // 2. Untuk setiap Agung yang ditemukan, cek tagihan orphan-nya
  for (const member of members) {
    console.log(`\n=== CEK AGUNG: ${member.name} (ID: ${member.id}) ===`);

    const { data: payments } = await supabase
      .from('payments')
      .select('id, session_id, nominal_tagihan, status_pembayaran, created_at')
      .eq('member_id', member.id);

    const { data: attendees } = await supabase
      .from('session_attendees')
      .select('session_id')
      .eq('member_id', member.id);

    console.log(`📋 Tagihan: ${payments?.length ?? 0} | 📅 Kehadiran: ${attendees?.length ?? 0}`);

    const attendeeSessionIds = new Set((attendees ?? []).map(a => a.session_id));
    const orphanPayments = (payments ?? []).filter(p => !attendeeSessionIds.has(p.session_id));

    if (orphanPayments.length === 0) {
      console.log('✅ Tidak ada tagihan orphan');
      continue;
    }

    console.log(`⚠️  Tagihan ORPHAN: ${orphanPayments.length} record`);
    orphanPayments.forEach(p => {
      console.log(`   Payment ID: ${p.id} | Sesi: ${p.session_id} | Nominal: Rp${p.nominal_tagihan?.toLocaleString()} | Status: ${p.status_pembayaran}`);
    });

    // Hapus orphan (kecuali verified/lunas/paid)
    const safeguard = ['verified', 'lunas', 'paid'];
    const toDelete = orphanPayments.filter(p => !safeguard.includes(p.status_pembayaran));

    if (toDelete.length > 0) {
      const ids = toDelete.map(p => p.id);
      console.log(`\n🗑️  Menghapus ${ids.length} tagihan orphan (IDs: ${ids.join(', ')})...`);
      const { error } = await supabase.from('payments').delete().in('id', ids);
      if (error) console.error('❌ Gagal:', error.message);
      else console.log('✅ Berhasil dihapus!');
    }
  }

  console.log('\n=== SELESAI ===\n');
}

run().catch(console.error);
