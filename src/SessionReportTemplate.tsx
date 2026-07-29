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
      name:     member?.name || 'Anggota',
      status:   statusOf(payment),
      metode:   methodOf(payment),
      lunas:    payment?.status_pembayaran === 'verified',
      rejected: payment?.status_pembayaran === 'rejected',
    };
  });

  const shortDate = (d: string) => {
    try {
      return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
    } catch { return d; }
  };

  const kasRows: { tanggal: string; jenis: string; keterangan: string; nominal: number; tipe: 'masuk' | 'keluar' }[] = [];

  const verifiedCount = payments.filter((p: any) => p.status_pembayaran === 'verified').length;
  if (verifiedCount > 0 && kasWajibPerOrang > 0) {
    kasRows.push({
      tanggal:    session.tanggal_main,
      jenis:      'Kas Wajib',
      keterangan: `${verifiedCount} × ${formatRp(kasWajibPerOrang)}`,
      nominal:    verifiedCount * kasWajibPerOrang,
      tipe:       'masuk',
    });
  }

  sessionExpenses.forEach((e: any) => {
    if (e.kategori === 'Sewa Lapangan' || e.kategori === 'Lapangan') return;
    const tipe = e.jenis_transaksi === 'masuk' ? 'masuk' as const : 'keluar' as const;
    kasRows.push({
      tanggal:    e.created_at || session.tanggal_main,
      jenis:      e.kategori || '-',
      keterangan: e.keterangan || '-',
      nominal:    e.nominal,
      tipe,
    });
  });

  kasRows.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  const totalKasMasuk  = kasRows.filter(r => r.tipe === 'masuk').reduce((s, r) => s + r.nominal, 0);
  const totalKasKeluar = kasRows.filter(r => r.tipe === 'keluar').reduce((s, r) => s + r.nominal, 0);
  const kasBersihSesi  = totalKasMasuk - totalKasKeluar;

  const pengeluaranRows = sessionExpenses.filter((e: any) => {
    if (e.kategori === 'Sewa Lapangan' || e.kategori === 'Lapangan') return false;
    if (e.jenis_transaksi === 'masuk') return false;
    return true;
  });
  const totalPengeluaranSesi = pengeluaranRows.reduce((s: number, e: any) => s + e.nominal, 0);

  const pendapatanOperasional = lunasCount * splitCost;
  const surplusOperasional    = pendapatanOperasional - biayaLapangan;

  const kasWajibTotal = verifiedCount * kasWajibPerOrang;
  const donasiTotal   = sessionExpenses
    .filter((e: any) => e.jenis_transaksi === 'masuk' && e.kategori === 'Donasi')
    .reduce((s: number, e: any) => s + e.nominal, 0);
  const sponsorTotal  = sessionExpenses
    .filter((e: any) => e.jenis_transaksi === 'masuk' && e.kategori === 'Sponsor')
    .reduce((s: number, e: any) => s + e.nominal, 0);
  const transferTotal = sessionExpenses
    .filter((e: any) => e.jenis_transaksi === 'masuk' && (
      e.kategori === 'Transfer' || e.kategori === 'Transfer Dana Operasional Sesi'
    ))
    .reduce((s: number, e: any) => s + e.nominal, 0);
  const totalKasOrganisasi = kasWajibTotal + donasiTotal + sponsorTotal + transferTotal;
  const saldoKasBertambah  = totalKasOrganisasi - totalPengeluaranSesi;

  return (
    <div
      id="session-report-content"
      style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        fontFamily: "'Manrope', 'Inter', 'Segoe UI', sans-serif",
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: '20px',
        color: '#1b1c1c',
        background: '#ffffff',
        boxSizing: 'border-box',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        /* ══════════════════════════════════════════════════════════
           DESIGN TOKENS — Viridian Ledger (from DESIGN.md)
        ══════════════════════════════════════════════════════════ */
        #session-report-content {
          --primary: #00422c;
          --on-primary: #ffffff;
          --primary-container: #005c3f;
          --on-primary-container: #87d2ad;
          --inverse-primary: #8ad6b1;
          --secondary: #57605e;
          --on-secondary: #ffffff;
          --secondary-container: #dbe5e1;
          --on-secondary-container: #5d6663;
          --tertiary: #790010;
          --on-tertiary: #ffffff;
          --tertiary-container: #a40019;
          --on-tertiary-container: #ffada8;
          --error: #ba1a1a;
          --on-error: #ffffff;
          --error-container: #ffdad6;
          --on-error-container: #93000a;
          --surface: #fbf9f8;
          --surface-dim: #dbdad9;
          --surface-bright: #fbf9f8;
          --surface-container-lowest: #ffffff;
          --surface-container-low: #f5f3f3;
          --surface-container: #efeded;
          --surface-container-high: #e9e8e7;
          --surface-container-highest: #e4e2e2;
          --on-surface: #1b1c1c;
          --on-surface-variant: #3f4943;
          --outline: #6f7973;
          --outline-variant: #bfc9c1;
          --surface-tint: #1b6b4d;
          --primary-fixed: #a6f3cc;
          --primary-fixed-dim: #8ad6b1;
          --on-primary-fixed: #002114;
          --on-primary-fixed-variant: #005137;
          --tertiary-fixed: #ffdad7;
          --tertiary-fixed-dim: #ffb3ae;

          /* Spacing tokens */
          --sp-container: 2rem;
          --sp-gap-lg: 1.5rem;
          --sp-gap-md: 1rem;
          --sp-gap-sm: 0.5rem;
          --sp-cell: 0.75rem 1rem;

          /* Radius tokens */
          --r-sm: 0.125rem;
          --r-default: 0.25rem;
          --r-md: 0.375rem;
          --r-lg: 0.5rem;
          --r-xl: 0.75rem;
          --r-full: 9999px;
        }

        #session-report-content * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-variant-numeric: tabular-nums;
        }

        /* ── PAGE BREAK ── */
        .ses-pdf-no-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* ══════════════════════════════════════════════════════════
           HEADER BANNER — Viridian Primary
        ══════════════════════════════════════════════════════════ */
        .ses-header {
          background: var(--primary);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          position: relative;
        }
        .ses-header::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background: var(--primary-fixed-dim);
        }
        .ses-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ses-header-logo {
          width: 34px; height: 34px;
          flex-shrink: 0;
        }
        .ses-header-identity {
          display: flex;
          flex-direction: column;
        }
        .ses-header-system {
          font-family: 'Manrope', sans-serif;
          font-size: 16px;
          font-weight: 800;
          line-height: 22px;
          letter-spacing: 0.02em;
          color: var(--on-primary);
          display: block;
        }
        .ses-header-subtitle {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 400;
          line-height: 16px;
          color: var(--on-primary-container);
          display: block;
          margin-top: 2px;
        }
        .ses-header-right {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .ses-header-doc-title {
          font-family: 'Manrope', sans-serif;
          font-size: 15px;
          font-weight: 700;
          line-height: 22px;
          color: var(--on-primary);
          display: block;
        }
        .ses-header-badge {
          margin-top: 4px;
          background: rgba(166,243,204,0.18);
          border: 1px solid rgba(166,243,204,0.35);
          border-radius: var(--r-full);
          padding: 2px 10px;
          display: inline-block;
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--primary-fixed);
        }

        /* ══════════════════════════════════════════════════════════
           INFO BAR — Document metadata
        ══════════════════════════════════════════════════════════ */
        .ses-info-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid var(--outline-variant);
          border-top: none;
          background: var(--surface-container-low);
          width: 100%;
        }
        .ses-info-cell {
          padding: 7px 14px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .ses-info-cell + .ses-info-cell {
          border-left: 1px solid var(--outline-variant);
        }
        .ses-info-label {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 15px;
          color: var(--outline);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .ses-info-value {
          font-family: 'Manrope', sans-serif;
          font-size: 13px;
          font-weight: 600;
          line-height: 18px;
          color: var(--on-surface);
        }

        /* ══════════════════════════════════════════════════════════
           SECTION — Numbered headers with dividers
        ══════════════════════════════════════════════════════════ */
        .ses-section {
          margin-top: var(--sp-gap-md);
          width: 100%;
          padding: 0 20px;
        }
        .ses-section-head {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          padding-bottom: 7px;
          border-bottom: 1px solid rgba(0,66,44,0.20);
        }
        .ses-section-num {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 800;
          line-height: 15px;
          color: var(--on-primary);
          background: var(--primary-container);
          width: 20px; height: 20px;
          border-radius: var(--r-default);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ses-section-title {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 18px;
          color: var(--on-surface);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ══════════════════════════════════════════════════════════
           SUMMARY CARDS
        ══════════════════════════════════════════════════════════ */
        .ses-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--sp-gap-sm);
          width: 100%;
        }
        .ses-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--sp-gap-sm);
          width: 100%;
        }
        .ses-card {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          padding: 8px 12px;
          background: var(--surface-container-lowest);
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .ses-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--outline);
        }
        .ses-card.accent-income::before  { background: var(--primary-container); }
        .ses-card.accent-expense::before { background: var(--tertiary-container); }
        .ses-card.accent-neutral::before { background: var(--outline); }
        .ses-card.accent-info::before    { background: var(--primary-fixed-dim); }
        .ses-card.accent-warn::before    { background: #c2410c; }

        .ses-card-icon {
          width: 14px; height: 14px;
          margin-bottom: 3px;
          flex-shrink: 0;
        }
        .ses-card-label {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 14px;
          color: var(--on-surface-variant);
          display: block;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ses-card-value {
          font-family: 'Manrope', sans-serif;
          font-size: 13px;
          font-weight: 600;
          line-height: 18px;
          color: var(--on-surface);
          display: block;
        }
        .ses-card-value.v-income  { color: var(--primary-container); }
        .ses-card-value.v-expense { color: var(--tertiary-container); }
        .ses-card-value.v-neutral { color: var(--on-surface); }
        .ses-card-value.v-warn    { color: #c2410c; }

        /* ══════════════════════════════════════════════════════════
           DATA TABLES — Primary green header, 1px row borders
        ══════════════════════════════════════════════════════════ */
        .ses-table-wrap {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          overflow: hidden;
          width: 100%;
        }
        .ses-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 400;
          line-height: 16px;
          table-layout: fixed;
        }
        .ses-table thead tr {
          background: var(--primary-container);
        }
        .ses-table th {
          color: var(--on-primary);
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 15px;
          padding: 7px 10px;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border: none;
        }
        .ses-table th.tc { text-align: center; }
        .ses-table th.tr { text-align: right; }
        .ses-table td {
          padding: 6px 10px;
          border-bottom: 1px solid var(--surface-container-high);
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 400;
          line-height: 16px;
          color: var(--on-surface);
          vertical-align: middle;
        }
        .ses-table td.tc { text-align: center; }
        .ses-table td.tr { text-align: right; }
        .ses-table tr:last-child td { border-bottom: none; }
        .ses-table tr { page-break-inside: avoid; break-inside: avoid; }

        .ses-table td.td-date {
          text-align: center;
          font-size: 11px;
          font-weight: 400;
          color: var(--on-surface-variant);
        }
        .ses-table td.td-num {
          text-align: center;
          font-size: 10px;
          color: var(--outline);
        }
        .ses-table td.td-amount {
          text-align: right;
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 600;
          line-height: 18px;
        }
        .ses-amount-income  { color: var(--primary-container) !important; font-weight: 700 !important; }
        .ses-amount-expense { color: var(--tertiary-container) !important; font-weight: 700 !important; }
        .ses-amount-neutral { color: var(--on-surface) !important; font-weight: 600 !important; }

        .ses-table tr.row-subtotal td {
          background: var(--surface-container-low);
          font-weight: 700;
          border-top: 1px solid var(--outline-variant);
          border-bottom: none;
          font-size: 11px;
        }
        .ses-table tr.row-final td {
          font-weight: 800;
          border-top: 2px solid var(--primary-fixed-dim);
          background: var(--surface-container-low);
          border-bottom: none;
          font-size: 12px;
        }

        /* ── CHIP / STATUS BADGE ── */
        .ses-chip {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--r-full);
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 15px;
          letter-spacing: 0.02em;
          text-align: center;
        }
        .ses-chip.green {
          background: rgba(0,92,63,0.08);
          color: var(--primary-container);
        }
        .ses-chip.red {
          background: rgba(164,0,25,0.08);
          color: var(--tertiary-container);
        }
        .ses-chip.gray {
          background: rgba(111,121,115,0.10);
          color: var(--outline);
        }
        .ses-chip.orange {
          background: rgba(194,65,12,0.08);
          color: #c2410c;
        }

        .ses-empty {
          text-align: center;
          color: var(--outline);
          font-size: 11px;
          font-style: italic;
          padding: 16px 0;
        }

        /* ══════════════════════════════════════════════════════════
           VERIF / KEY-VALUE BLOCK
        ══════════════════════════════════════════════════════════ */
        .ses-verif-card {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          overflow: hidden;
          width: 100%;
        }
        .ses-verif-card-head {
          background: var(--primary-container);
          color: var(--on-primary);
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 15px;
          padding: 7px 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .ses-verif-card-head.red {
          background: var(--tertiary-container);
        }
        .ses-verif-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          border-bottom: 1px solid var(--surface-container-high);
        }
        .ses-verif-row:last-child { border-bottom: none; }
        .ses-verif-row.total {
          background: var(--surface-container-low);
          border-top: 1px solid var(--outline-variant);
        }
        .ses-verif-k {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 400;
          line-height: 16px;
          color: var(--on-surface-variant);
        }
        .ses-verif-v {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 600;
          line-height: 18px;
          color: var(--on-surface);
        }
        .ses-verif-v.income  { color: var(--primary-container); }
        .ses-verif-v.expense { color: var(--tertiary-container); }

        /* Sub-header inside verif card */
        .ses-verif-sub {
          padding: 5px 12px 4px;
          background: var(--surface-container-low);
          border-top: 1px solid var(--outline-variant);
          border-bottom: 1px solid var(--outline-variant);
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 14px;
          color: var(--on-surface-variant);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* ══════════════════════════════════════════════════════════
           INFO GRID (session detail)
        ══════════════════════════════════════════════════════════ */
        .ses-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px 20px;
          width: 100%;
        }
        .ses-detail-row {
          display: flex;
          gap: 8px;
          align-items: baseline;
        }
        .ses-detail-label {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 15px;
          color: var(--outline);
          min-width: 64px;
          flex-shrink: 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ses-detail-value {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 600;
          line-height: 17px;
          color: var(--on-surface);
        }

        /* ══════════════════════════════════════════════════════════
           OPERASIONAL CARD
        ══════════════════════════════════════════════════════════ */
        .ses-ops-card {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          overflow: hidden;
          width: 100%;
        }
        .ses-ops-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          border-bottom: 1px solid var(--surface-container-high);
        }
        .ses-ops-row:last-child { border-bottom: none; }
        .ses-ops-row.total-row {
          background: var(--surface-container-low);
          border-top: 1px solid var(--outline-variant);
          padding: 8px 12px;
        }
        .ses-ops-label-wrap { display: flex; flex-direction: column; }
        .ses-ops-label {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 600;
          line-height: 16px;
          color: var(--on-surface);
        }
        .ses-ops-sub {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 400;
          line-height: 14px;
          color: var(--outline);
          margin-top: 1px;
        }
        .ses-ops-val {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 18px;
          color: var(--on-surface);
        }
        .ses-ops-val.income  { color: var(--primary-container); }
        .ses-ops-val.expense { color: var(--tertiary-container); }

        /* ══════════════════════════════════════════════════════════
           CATATAN (note block)
        ══════════════════════════════════════════════════════════ */
        .ses-note {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: var(--r-default);
          padding: 8px 12px;
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 400;
          line-height: 17px;
          color: #92400e;
        }

        /* ══════════════════════════════════════════════════════════
           FOOTER
        ══════════════════════════════════════════════════════════ */
        .ses-doc-footer {
          margin-top: var(--sp-gap-md);
          padding: 8px 20px 0 20px;
          border-top: 1px solid var(--outline-variant);
          display: flex;
          justify-content: space-between;
          width: 100%;
        }
        .ses-doc-footer-txt {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 15px;
          color: var(--outline);
        }
      `}} />

      {/* ════════════════════════════════════════════════════════════
          HEADER BANNER — Viridian Primary
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-header">
        <div className="ses-header-left">
          {/* Logo — Badminton shuttlecock icon, stroke-based 2px */}
          <svg className="ses-header-logo" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="19" cy="19" r="17" stroke="#a6f3cc" strokeWidth="2" fill="rgba(166,243,204,0.12)"/>
            <path d="M19 8c0 6-4 10-4 14.5a4 4 0 108 0C23 18 19 14 19 8z" stroke="#a6f3cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <line x1="17" y1="15" x2="21" y2="15" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16.5" y1="18" x2="21.5" y2="18" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16.5" y1="21" x2="21.5" y2="21" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="19" cy="27" r="2" stroke="#a6f3cc" strokeWidth="1.5" fill="none"/>
          </svg>
          <div className="ses-header-identity">
            <span className="ses-header-system">SI-PATRA</span>
            <span className="ses-header-subtitle">{namaKomunitas || 'Sistem Informasi Badminton & Kas'}</span>
          </div>
        </div>
        <div className="ses-header-right">
          <span className="ses-header-doc-title">Laporan Sesi Badminton</span>
          <span className="ses-header-badge">{sessionCode}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          INFO BAR — Session metadata
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-info-bar">
        <div className="ses-info-cell">
          <span className="ses-info-label">Tanggal Sesi</span>
          <span className="ses-info-value">{formatDate(session.tanggal_main)}</span>
        </div>
        <div className="ses-info-cell">
          <span className="ses-info-label">Nama Sesi</span>
          <span className="ses-info-value">{session.nama_sesi}</span>
        </div>
        <div className="ses-info-cell">
          <span className="ses-info-label">Lokasi</span>
          <span className="ses-info-value">{session.lokasi || '-'}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          01. INFORMASI SESI
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-section ses-pdf-no-break">
        <div className="ses-section-head">
          <span className="ses-section-num">01</span>
          <span className="ses-section-title">Informasi Sesi</span>
        </div>
        <div className="ses-verif-card">
          <div className="ses-detail-grid" style={{ padding: '8px 12px' }}>
            {[
              { label: 'Kode Sesi',  value: sessionCode },
              { label: 'Waktu',      value: session.jam_main || '-' },
              { label: 'Tanggal',    value: formatDate(session.tanggal_main) },
              { label: 'Lokasi',     value: session.lokasi || '-' },
              { label: 'Dicetak',    value: printDate },
            ].map(({ label, value }) => (
              <div key={label} className="ses-detail-row">
                <span className="ses-detail-label">{label}</span>
                <span className="ses-detail-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          02. RINGKASAN SESI
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-section ses-pdf-no-break">
        <div className="ses-section-head">
          <span className="ses-section-num">02</span>
          <span className="ses-section-title">Ringkasan Sesi</span>
        </div>
        <div className="ses-grid-3">
          <div className="ses-card accent-neutral">
            <svg className="ses-card-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#6f7973" strokeWidth="1.5" fill="none"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#6f7973" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
            <span className="ses-card-label">Peserta Hadir</span>
            <span className="ses-card-value v-neutral">{n} orang</span>
          </div>
          <div className="ses-card accent-income">
            <svg className="ses-card-icon" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="#005c3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="ses-card-label">Peserta Lunas</span>
            <span className="ses-card-value v-income">{lunasCount} orang</span>
          </div>
          <div className={`ses-card ${belumCount > 0 ? 'accent-expense' : 'accent-neutral'}`}>
            <svg className="ses-card-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke={belumCount > 0 ? '#a40019' : '#6f7973'} strokeWidth="1.5" fill="none"/><path d="M8 5v3" stroke={belumCount > 0 ? '#a40019' : '#6f7973'} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.5" fill={belumCount > 0 ? '#a40019' : '#6f7973'} stroke={belumCount > 0 ? '#a40019' : '#6f7973'}/></svg>
            <span className="ses-card-label">Belum Bayar</span>
            <span className={`ses-card-value ${belumCount > 0 ? 'v-expense' : 'v-neutral'}`}>{belumCount} orang</span>
          </div>
          <div className="ses-card accent-neutral">
            <svg className="ses-card-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke="#6f7973" strokeWidth="1.5" fill="none"/><path d="M5 4V3M11 4V3" stroke="#6f7973" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span className="ses-card-label">Biaya Lapangan</span>
            <span className="ses-card-value v-neutral">{formatRp(biayaLapangan)}</span>
          </div>
          <div className="ses-card accent-info">
            <svg className="ses-card-icon" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M8 4l-3 3M8 4l3 3" stroke="#8ad6b1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="ses-card-label">Kas Masuk Sesi</span>
            <span className="ses-card-value v-income">+{formatRp(totalKasMasuk)}</span>
          </div>
          <div className={`ses-card ${saldoKasBertambah >= 0 ? 'accent-income' : 'accent-expense'}`}>
            <svg className="ses-card-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke={saldoKasBertambah >= 0 ? '#005c3f' : '#a40019'} strokeWidth="1.5" fill="none"/><path d="M5 8h6" stroke={saldoKasBertambah >= 0 ? '#005c3f' : '#a40019'} strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span className="ses-card-label">Saldo Kas Bertambah</span>
            <span className={`ses-card-value ${saldoKasBertambah >= 0 ? 'v-income' : 'v-expense'}`}>
              {saldoKasBertambah >= 0 ? '+' : '-'}{formatRp(Math.abs(saldoKasBertambah))}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          03. DAFTAR KEHADIRAN & PEMBAYARAN
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-section">
        <div className="ses-section-head">
          <span className="ses-section-num">03</span>
          <span className="ses-section-title">Daftar Kehadiran &amp; Pembayaran Peserta</span>
        </div>
        <div className="ses-table-wrap">
          <table className="ses-table">
            <thead>
              <tr>
                <th className="tc" style={{ width: '7%' }}>No</th>
                <th style={{ width: '43%' }}>Nama Peserta</th>
                <th className="tc" style={{ width: '17%' }}>Kehadiran</th>
                <th className="tc" style={{ width: '17%' }}>Metode</th>
                <th className="tc" style={{ width: '16%' }}>Status Bayar</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="ses-empty">Belum ada peserta yang hadir.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td className="td-num">{i + 1}</td>
                  <td style={{ fontWeight: 600, fontSize: '11px' }}>{r.name}</td>
                  <td className="tc">
                    <span className="ses-chip green">Hadir</span>
                  </td>
                  <td className="tc">
                    {r.metode !== '-' ? (
                      <span className={`ses-chip ${r.metode === 'Cash' ? 'orange' : 'green'}`}>{r.metode}</span>
                    ) : (
                      <span style={{ color: 'var(--outline)', fontSize: '11px' }}>-</span>
                    )}
                  </td>
                  <td className="tc">
                    <span className={`ses-chip ${r.lunas ? 'green' : r.rejected ? 'red' : 'gray'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          04. RINCIAN OPERASIONAL LAPANGAN
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-section ses-pdf-no-break">
        <div className="ses-section-head">
          <span className="ses-section-num">04</span>
          <span className="ses-section-title">Rincian Operasional Lapangan</span>
        </div>
        <div className="ses-ops-card">
          <div className="ses-ops-row">
            <div className="ses-ops-label-wrap">
              <span className="ses-ops-label">Split Biaya per Peserta</span>
              {biayaLapangan === 0 && <span className="ses-ops-sub">Belum ada biaya lapangan</span>}
            </div>
            <span className="ses-ops-val">{formatRp(splitCost)}</span>
          </div>
          <div className="ses-ops-row">
            <div className="ses-ops-label-wrap">
              <span className="ses-ops-label">Total Pembayaran Operasional</span>
              <span className="ses-ops-sub">{lunasCount} peserta lunas × {formatRp(splitCost)}</span>
            </div>
            <span className="ses-ops-val income">+{formatRp(pendapatanOperasional)}</span>
          </div>
          <div className="ses-ops-row">
            <div className="ses-ops-label-wrap">
              <span className="ses-ops-label">Biaya Sewa Lapangan</span>
              <span className="ses-ops-sub">Total pengeluaran sewa lapangan</span>
            </div>
            <span className="ses-ops-val expense">-{formatRp(biayaLapangan)}</span>
          </div>
          <div className="ses-ops-row total-row">
            <div className="ses-ops-label-wrap">
              <span className="ses-ops-label" style={{ fontWeight: 800, color: surplusOperasional >= 0 ? 'var(--primary-container)' : 'var(--tertiary-container)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10px' }}>
                Surplus / Defisit Operasional
              </span>
            </div>
            <span className="ses-ops-val" style={{ fontSize: '13px', fontWeight: 800, color: surplusOperasional >= 0 ? 'var(--primary-container)' : 'var(--tertiary-container)' }}>
              {surplusOperasional >= 0 ? '+' : '-'}{formatRp(Math.abs(surplusOperasional))}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          05. TRANSAKSI KAS PADA SESI
      ════════════════════════════════════════════════════════════ */}
      {kasRows.length > 0 && (
        <div className="ses-section">
          <div className="ses-section-head">
            <span className="ses-section-num">05</span>
            <span className="ses-section-title">Transaksi Kas Pada Sesi</span>
          </div>
          <div className="ses-table-wrap" style={{ marginBottom: '8px' }}>
            <table className="ses-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Tanggal</th>
                  <th style={{ width: '24%' }}>Jenis</th>
                  <th style={{ width: '32%' }}>Keterangan</th>
                  <th className="tr" style={{ width: '22%' }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {kasRows.map((row, i) => (
                  <tr key={i}>
                    <td className="td-date" style={{ textAlign: 'left' }}>{shortDate(row.tanggal)}</td>
                    <td style={{ fontWeight: 600 }}>{row.jenis}</td>
                    <td style={{ fontWeight: 500 }}>{row.keterangan}</td>
                    <td className={`td-amount ${row.tipe === 'masuk' ? 'ses-amount-income' : 'ses-amount-expense'}`}>
                      {row.tipe === 'masuk' ? '+' : '-'}{formatRp(row.nominal)}
                    </td>
                  </tr>
                ))}
                <tr className="row-subtotal">
                  <td colSpan={3} className="tr" style={{ color: '#3f4943' }}>Total Kas Masuk</td>
                  <td className="td-amount ses-amount-income">+{formatRp(totalKasMasuk)}</td>
                </tr>
                <tr className="row-subtotal">
                  <td colSpan={3} className="tr" style={{ color: '#3f4943' }}>Total Kas Keluar</td>
                  <td className="td-amount ses-amount-expense">-{formatRp(totalKasKeluar)}</td>
                </tr>
                <tr className="row-final">
                  <td colSpan={3} className="tr" style={{ color: '#3f4943' }}>Kas Bersih Sesi</td>
                  <td className={`td-amount ${kasBersihSesi >= 0 ? 'ses-amount-income' : 'ses-amount-expense'}`}>
                    {kasBersihSesi >= 0 ? '+' : '-'}{formatRp(Math.abs(kasBersihSesi))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          06. PENGELUARAN SELAMA SESI
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-section">
        <div className="ses-section-head">
          <span className="ses-section-num">{kasRows.length > 0 ? '06' : '05'}</span>
          <span className="ses-section-title">Pengeluaran Selama Sesi</span>
        </div>
        {pengeluaranRows.length === 0 ? (
          <div className="ses-verif-card">
            <div className="ses-empty">Tidak ada pengeluaran pada sesi ini.</div>
          </div>
        ) : (
          <div className="ses-table-wrap">
            <table className="ses-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Tanggal</th>
                  <th className="tc" style={{ width: '23%' }}>Kategori</th>
                  <th style={{ width: '33%' }}>Keterangan</th>
                  <th className="tr" style={{ width: '22%' }}>Nominal</th>
                </tr>
              </thead>
              <tbody>
                {pengeluaranRows.map((e: any, i: number) => (
                  <tr key={e.id ?? i}>
                    <td className="td-date" style={{ textAlign: 'left' }}>{shortDate(e.created_at || session.tanggal_main)}</td>
                    <td className="tc">
                      <span className="ses-chip red">{e.kategori || '-'}</span>
                    </td>
                    <td>{e.keterangan || '-'}</td>
                    <td className="td-amount ses-amount-expense">-{formatRp(e.nominal)}</td>
                  </tr>
                ))}
                <tr className="row-final">
                  <td colSpan={3} className="tr" style={{ color: '#3f4943' }}>Total Pengeluaran Sesi</td>
                  <td className="td-amount ses-amount-expense">-{formatRp(totalPengeluaranSesi)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          RINGKASAN KEUANGAN SESI (Verif-style dual card)
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-section ses-pdf-no-break">
        <div className="ses-section-head">
          <span className="ses-section-num">{kasRows.length > 0 ? '07' : '06'}</span>
          <span className="ses-section-title">Ringkasan Keuangan Sesi</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-gap-sm)' }}>

          {/* Operasional Sesi */}
          <div className="ses-verif-card">
            <div className="ses-verif-card-head">Operasional Sesi</div>
            <div className="ses-verif-row">
              <span className="ses-verif-k">Pendapatan Operasional</span>
              <span className="ses-verif-v income">+{formatRp(pendapatanOperasional)}</span>
            </div>
            <div className="ses-verif-row">
              <span className="ses-verif-k">Biaya Lapangan</span>
              <span className="ses-verif-v expense">-{formatRp(biayaLapangan)}</span>
            </div>
            <div className="ses-verif-row total">
              <span className="ses-verif-k" style={{ color: '#1b1c1c', fontWeight: 700 }}>Surplus / Defisit</span>
              <span className={`ses-verif-v ${surplusOperasional >= 0 ? 'income' : 'expense'}`} style={{ fontWeight: 800 }}>
                {surplusOperasional >= 0 ? '+' : '-'}{formatRp(Math.abs(surplusOperasional))}
              </span>
            </div>
          </div>

          {/* Kas Organisasi */}
          <div className="ses-verif-card">
            <div className="ses-verif-card-head">Kas Organisasi</div>
            <div className="ses-verif-sub">Pemasukan</div>
            <div className="ses-verif-row">
              <span className="ses-verif-k">Kas Wajib{kasWajibTotal > 0 ? ` (${verifiedCount}×)` : ''}</span>
              <span className="ses-verif-v income">+{formatRp(kasWajibTotal)}</span>
            </div>
            {donasiTotal > 0 && (
              <div className="ses-verif-row">
                <span className="ses-verif-k">Donasi</span>
                <span className="ses-verif-v income">+{formatRp(donasiTotal)}</span>
              </div>
            )}
            {sponsorTotal > 0 && (
              <div className="ses-verif-row">
                <span className="ses-verif-k">Sponsor</span>
                <span className="ses-verif-v income">+{formatRp(sponsorTotal)}</span>
              </div>
            )}
            {transferTotal > 0 && (
              <div className="ses-verif-row">
                <span className="ses-verif-k">Transfer</span>
                <span className="ses-verif-v income">+{formatRp(transferTotal)}</span>
              </div>
            )}
            <div className="ses-verif-sub">Pengeluaran</div>
            <div className="ses-verif-row">
              <span className="ses-verif-k">Pengeluaran Selain Lapangan</span>
              <span className="ses-verif-v expense">-{formatRp(totalPengeluaranSesi)}</span>
            </div>
            <div className="ses-verif-row total">
              <span className="ses-verif-k" style={{ color: '#1b1c1c', fontWeight: 700 }}>Saldo Kas Bertambah</span>
              <span className={`ses-verif-v ${saldoKasBertambah >= 0 ? 'income' : 'expense'}`} style={{ fontWeight: 800 }}>
                {saldoKasBertambah >= 0 ? '+' : '-'}{formatRp(Math.abs(saldoKasBertambah))}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          CATATAN SESI (only if exists)
      ════════════════════════════════════════════════════════════ */}
      {session.catatan && (
        <div className="ses-section ses-pdf-no-break">
          <div className="ses-section-head">
            <span className="ses-section-num">
              {kasRows.length > 0 ? '08' : '07'}
            </span>
            <span className="ses-section-title">Catatan Sesi</span>
          </div>
          <div className="ses-note">{session.catatan}</div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          DOCUMENT FOOTER
      ════════════════════════════════════════════════════════════ */}
      <div className="ses-doc-footer" style={{ marginTop: '16px' }}>
        <span className="ses-doc-footer-txt">
          SI-PATRA · {sessionCode} · Dokumen Resmi &amp; Rahasia
        </span>
        <span className="ses-doc-footer-txt">Dicetak: {printDate}</span>
      </div>

    </div>
  );
};
