import React from 'react';

interface SessionReportProps {
  session: any;
  attendees: any[];
  payments: any[];
  members: any[];
  biayaLapangan: number;
  kasWajibPerOrang: number;
  formatRp: (n: number) => string;
  formatDate: (s: string) => string;
  namaKomunitas: string;
  sessionExpenses: any[];
}

export const SessionReportTemplate: React.FC<SessionReportProps> = ({
  session,
  attendees,
  payments,
  members,
  biayaLapangan,
  kasWajibPerOrang,
  formatRp,
  formatDate,
  namaKomunitas,
  sessionExpenses,
}) => {
  const n           = attendees.length;
  const lunasCount  = payments.filter((p: any) => p.status_pembayaran === 'verified').length;
  const belumCount  = n - lunasCount;
  const totalKas    = lunasCount * kasWajibPerOrang;
  const splitCost   = n > 0 ? Math.round(biayaLapangan / n) : 0;

  const sessionCode = `SES-${String(session.id).padStart(4, '0')}`;
  const printDate   = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  const methodOf = (p: any) => {
    if (!p) return '-';
    if (p.bukti_transfer === 'CASH') return 'Cash';
    if (p.bukti_transfer || p.status_pembayaran === 'uploaded') return 'QRIS';
    return '-';
  };
  const statusOf = (p: any) => {
    if (!p) return 'Belum Bayar';
    const s = p.status_pembayaran;
    if (s === 'verified') return 'Lunas';
    if (s === 'uploaded') return 'Menunggu Verifikasi';
    if (s === 'Menunggu Verifikasi Cash') return 'Menunggu Konfirmasi';
    if (s === 'rejected') return 'Ditolak';
    return 'Belum Bayar';
  };

  const rows = attendees.map((a: any) => {
    const member  = members.find((m: any) => m.id === a.member_id);
    const payment = payments.find((p: any) => p.member_id === a.member_id);
    return {
      name:   member?.name || 'Anggota',
      status: statusOf(payment),
      metode: methodOf(payment),
      lunas:  payment?.status_pembayaran === 'verified',
      rejected: payment?.status_pembayaran === 'rejected',
    };
  });

  // ── Build "TRANSAKSI KAS PADA SESI" data ──
  // Short date formatter for table rows: "05 Jul 2026"
  const shortDate = (d: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
    } catch { return d; }
  };

  const kasRows: { tanggal: string; jenis: string; keterangan: string; nominal: number; tipe: 'masuk' | 'keluar' }[] = [];

  // 1. Kas Wajib – aggregate all verified payments into ONE row
  const verifiedCount = payments.filter((p: any) => p.status_pembayaran === 'verified').length;
  if (verifiedCount > 0 && kasWajibPerOrang > 0) {
    kasRows.push({
      tanggal: session.tanggal_main,
      jenis: 'Kas Wajib',
      keterangan: `${verifiedCount} x ${formatRp(kasWajibPerOrang)}`,
      nominal: verifiedCount * kasWajibPerOrang,
      tipe: 'masuk',
    });
  }

  // 2. Session expenses (Shuttlecock, Konsumsi, Donasi, Sponsor, Parkir, Administrasi, Lainnya, etc.)
  //    Exclude "Sewa Lapangan" because it's already covered in Rincian Operasional
  sessionExpenses.forEach((e: any) => {
    if (e.kategori === 'Sewa Lapangan' || e.kategori === 'Lapangan') return;
    const tipe = e.jenis_transaksi === 'masuk' ? 'masuk' as const : 'keluar' as const;
    kasRows.push({
      tanggal: e.created_at || session.tanggal_main,
      jenis: e.kategori || '-',
      keterangan: e.keterangan || '-',
      nominal: e.nominal,
      tipe,
    });
  });

  // Sort by date
  kasRows.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  // Totals
  const totalKasMasuk  = kasRows.filter(r => r.tipe === 'masuk').reduce((s, r) => s + r.nominal, 0);
  const totalKasKeluar = kasRows.filter(r => r.tipe === 'keluar').reduce((s, r) => s + r.nominal, 0);
  const kasBersihSesi  = totalKasMasuk - totalKasKeluar;

  const GREEN   = '#15803d';
  const GREEN_L = '#dcfce7';
  const GREEN_M = '#16a34a';
  const SLATE   = '#334155';
  const GRAY    = '#64748b';
  const BORDER  = '#e2e8f0';

  const cellStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderBottom: `1px solid ${BORDER}`,
    fontSize: '9px',
    color: SLATE,
    verticalAlign: 'middle',
  };
  const thStyle: React.CSSProperties = {
    padding: '5px 8px',
    background: GREEN,
    color: '#fff',
    fontSize: '8px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    textAlign: 'left' as const,
  };

  return (
    <div
      id="session-report-content"
      style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        background: '#fff',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        fontSize: '10px',
        color: '#1e293b',
        boxSizing: 'border-box',
        padding: '10mm 12mm 10mm 12mm',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        #session-report-content * { box-sizing: border-box; }
        #session-report-content table { border-collapse: collapse; width: 100%; }
      `}} />

      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_M} 100%)`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '34px', height: '34px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="18" r="3" fill="white" opacity="0.9"/>
              <path d="M12 15 L8 5 M12 15 L12 5 M12 15 L16 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8 5 Q10 3 12 5 Q14 3 16 5" stroke="white" strokeWidth="1.2" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '12px', letterSpacing: '-0.3px' }}>SI-PATRA</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '8px', fontWeight: 500 }}>
              {namaKomunitas || 'Sistem Informasi Badminton'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>Laporan Sesi Badminton</div>
          <div style={{
            marginTop: '3px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '4px',
            padding: '1px 6px',
            display: 'inline-block',
            color: 'rgba(255,255,255,0.9)',
            fontSize: '8px',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>{sessionCode}</div>
        </div>
      </div>

      {/* INFO SESI */}
      <div style={{
        border: `1px solid ${BORDER}`,
        borderRadius: '6px',
        padding: '8px 12px',
        marginBottom: '8px',
        background: '#f8fafc',
      }}>
        <div style={{ fontWeight: 700, fontSize: '8px', color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '5px' }}>
          Informasi Sesi
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {[
            { label: 'Nama Sesi',  value: session.nama_sesi },
            { label: 'Kode Sesi',  value: sessionCode },
            { label: 'Tanggal',    value: formatDate(session.tanggal_main) },
            { label: 'Waktu',      value: session.jam_main || '-' },
            { label: 'Lokasi',     value: session.lokasi },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ color: GRAY, fontSize: '8px', fontWeight: 500, minWidth: '60px', flexShrink: 0 }}>{label}:</span>
              <span style={{ color: SLATE, fontSize: '8.5px', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RINGKASAN */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '8px', color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>
          Ringkasan Sesi
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          {[
            { label: 'Peserta Hadir',     value: `${n} orang`,             type: 'neutral' },
            { label: 'Peserta Lunas',     value: `${lunasCount} orang`,     type: 'success' },
            { label: 'Belum Bayar',       value: `${belumCount} orang`,     type: belumCount > 0 ? 'danger' : 'neutral' },
            { label: 'Biaya Lapangan',    value: formatRp(biayaLapangan),  type: 'neutral' },
            { label: 'Kas Masuk Sesi',    value: formatRp(totalKas),        type: 'success' },
            { label: 'Surplus / Defisit', value: 'Rp0 (Seimbang)',         type: 'success' },
          ].map(({ label, value, type }) => (
            <div key={label} style={{
              background: type === 'success' ? GREEN_L : type === 'danger' ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${type === 'success' ? '#bbf7d0' : type === 'danger' ? '#fecaca' : BORDER}`,
              borderRadius: '5px',
              padding: '5px 8px',
              display: 'flex',
              flexDirection: 'column' as const,
              justifyContent: 'center',
            }}>
              <span style={{ color: GRAY, fontSize: '7.5px', fontWeight: 500 }}>{label}</span>
              <span style={{
                color: type === 'success' ? GREEN : type === 'danger' ? '#dc2626' : SLATE,
                fontSize: '8.5px', fontWeight: 700, marginTop: '2px'
              }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DAFTAR PESERTA */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '8px', color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>
          Daftar Kehadiran & Pembayaran Peserta
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '24px', textAlign: 'center' as const, borderRadius: '4px 0 0 0' }}>No</th>
              <th style={thStyle}>Nama</th>
              <th style={{ ...thStyle, width: '60px', textAlign: 'center' as const }}>Kehadiran</th>
              <th style={{ ...thStyle, width: '60px', textAlign: 'center' as const }}>Metode</th>
              <th style={{ ...thStyle, width: '100px', textAlign: 'center' as const, borderRadius: '0 4px 0 0' }}>Status Bayar</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...cellStyle, textAlign: 'center' as const, color: GRAY, fontStyle: 'italic', padding: '8px' }}>
                  Belum ada peserta yang hadir.
                </td>
              </tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ ...cellStyle, textAlign: 'center' as const, color: GRAY, fontSize: '8px' }}>{i + 1}</td>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{r.name}</td>
                <td style={{ ...cellStyle, textAlign: 'center' as const }}>
                  <span style={{
                    background: GREEN_L, color: GREEN,
                    fontSize: '7px', fontWeight: 700,
                    padding: '1px 5px', borderRadius: '10px',
                    border: `1px solid #bbf7d0`,
                  }}>Hadir</span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' as const }}>
                  {r.metode !== '-' ? (
                    <span style={{
                      background: r.metode === 'Cash' ? '#fff7ed' : '#f0fdf4',
                      color: r.metode === 'Cash' ? '#c2410c' : GREEN_M,
                      fontSize: '7px', fontWeight: 700,
                      padding: '1px 5px', borderRadius: '10px',
                      border: `1px solid ${r.metode === 'Cash' ? '#fed7aa' : '#bbf7d0'}`,
                    }}>{r.metode}</span>
                  ) : <span style={{ color: GRAY, fontSize: '8px' }}>-</span>}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' as const }}>
                  <span style={{
                    background: r.lunas ? GREEN_L : r.rejected ? '#fef2f2' : '#f1f5f9',
                    color: r.lunas ? GREEN : r.rejected ? '#dc2626' : GRAY,
                    fontSize: '7px', fontWeight: 700,
                    padding: '1px 6px', borderRadius: '10px',
                    border: `1px solid ${r.lunas ? '#bbf7d0' : r.rejected ? '#fecaca' : BORDER}`,
                  }}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RINCIAN OPERASIONAL */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '8px', color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>
          Rincian Operasional Lapangan
        </div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: '6px', overflow: 'hidden' }}>
          {[
            { label: 'Split Biaya per Peserta',      value: formatRp(splitCost),               sub: `${biayaLapangan === 0 ? 'Belum ada biaya lapangan' : ''}` },
            { label: 'Total Pembayaran Operasional', value: formatRp(lunasCount * splitCost),   sub: `${lunasCount} peserta lunas × ${formatRp(splitCost)}` },
            { label: 'Biaya Sewa Lapangan',          value: formatRp(biayaLapangan),            sub: 'Total pengeluaran sewa lapangan' },
          ].map(({ label, value, sub }, i) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 10px',
              background: i % 2 === 0 ? '#fff' : '#f8fafc',
              borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none',
            }}>
              <div>
                <div style={{ color: SLATE, fontSize: '8.5px', fontWeight: 600 }}>{label}</div>
                {sub && <div style={{ color: GRAY, fontSize: '7.5px', marginTop: '1px' }}>{sub}</div>}
              </div>
              <span style={{ color: SLATE, fontSize: '9px', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px',
            background: '#f0fdf4',
            borderTop: `1px solid #bbf7d0`,
          }}>
            <span style={{ color: GREEN, fontSize: '8.5px', fontWeight: 800 }}>Surplus / Defisit Operasional</span>
            <span style={{ color: GREEN, fontSize: '9px', fontWeight: 800 }}>Rp0 (Seimbang)</span>
          </div>
        </div>
      </div>

      {/* 💳 TRANSAKSI KAS PADA SESI — hidden when no kas transactions */}
      {kasRows.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '8px', color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '4px' }}>
            💳 Transaksi Kas Pada Sesi
          </div>
          <table style={{ marginBottom: '4px' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '80px', borderRadius: '4px 0 0 0' }}>Tanggal</th>
                <th style={{ ...thStyle, width: '90px' }}>Jenis</th>
                <th style={thStyle}>Keterangan</th>
                <th style={{ ...thStyle, width: '100px', textAlign: 'right' as const, borderRadius: '0 4px 0 0' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {kasRows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ ...cellStyle, fontSize: '8px', whiteSpace: 'nowrap' as const }}>{shortDate(row.tanggal)}</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{row.jenis}</td>
                  <td style={{ ...cellStyle, fontWeight: 500 }}>{row.keterangan}</td>
                  <td style={{
                    ...cellStyle,
                    textAlign: 'right' as const,
                    fontWeight: 700,
                    color: row.tipe === 'masuk' ? GREEN : '#dc2626',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {row.tipe === 'masuk' ? '+' : '-'}{formatRp(row.nominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Ringkasan Kas Sesi */}
          <div style={{
            border: `1px solid ${BORDER}`,
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            {[
              { label: 'Total Kas Masuk',  value: formatRp(totalKasMasuk),  color: GREEN,     prefix: '+' },
              { label: 'Total Kas Keluar', value: formatRp(totalKasKeluar), color: '#dc2626',  prefix: '-' },
            ].map(({ label, value, color, prefix }, i) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 10px',
                background: i % 2 === 0 ? '#fff' : '#f8fafc',
                borderBottom: `1px solid ${BORDER}`,
              }}>
                <span style={{ color: SLATE, fontSize: '8.5px', fontWeight: 600 }}>{label}</span>
                <span style={{ color, fontSize: '9px', fontWeight: 700 }}>{prefix}{value}</span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px',
              background: '#f0fdf4',
            }}>
              <span style={{ color: GREEN, fontSize: '8.5px', fontWeight: 800 }}>Kas Bersih Sesi</span>
              <span style={{
                color: kasBersihSesi >= 0 ? GREEN : '#dc2626',
                fontSize: '10px',
                fontWeight: 800,
              }}>
                {kasBersihSesi >= 0 ? '+' : ''}{formatRp(kasBersihSesi)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CATATAN (only if exists) */}
      {session.catatan && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, fontSize: '8px', color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '3px' }}>
            Catatan Sesi
          </div>
          <div style={{
            background: '#fffbeb', border: `1px solid #fde68a`,
            borderRadius: '5px', padding: '6px 10px',
            fontSize: '8.5px', color: '#92400e', lineHeight: '1.4',
          }}>
            {session.catatan}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{
        marginTop: '8px',
        paddingTop: '6px',
        borderTop: `1px solid ${BORDER}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: GRAY, fontSize: '7.5px' }}>
          Generated by <strong style={{ color: GREEN }}>SI-PATRA</strong>
          {namaKomunitas ? ` — ${namaKomunitas}` : ''}
        </span>
        <span style={{ color: GRAY, fontSize: '7.5px' }}>Dicetak: {printDate}</span>
      </div>
    </div>
  );
};

