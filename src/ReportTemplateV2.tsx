import React from 'react';

interface ReportTemplateV2Props {
  reportData: any;
  periodStr: string;
  formatToday: () => string;
  selectedYear: number;
  selectedMonth: number;
  superadminName: string;
  bendaharaName: string;
  profile: any;
  userRole: string;
  formatRp: (val: number) => string;
  formatDate: (dateStr: string) => string;
}

const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

export const ReportTemplateV2: React.FC<ReportTemplateV2Props> = ({
  reportData,
  periodStr,
  formatToday,
  selectedYear,
  selectedMonth,
  superadminName,
  bendaharaName,
  profile,
  userRole,
  formatRp,
  formatDate,
}) => {
  const reportCode = `LKB-${selectedYear}${String(selectedMonth + 1).padStart(2, '0')}-001`;
  const monthName  = MONTH_NAMES[selectedMonth] ?? String(selectedMonth + 1);

  return (
    <div
      id="report-content"
      style={{
        width: '100%',
        fontFamily: "'Manrope', 'Inter', 'Segoe UI', sans-serif",
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: '20px',
        color: '#1b1c1c',
        background: '#ffffff',
        boxSizing: 'border-box',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        /* ══════════════════════════════════════════════════════════
           DESIGN TOKENS — Viridian Ledger (from DESIGN.md)
        ══════════════════════════════════════════════════════════ */
        #report-content {
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

        #report-content * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-variant-numeric: tabular-nums;
        }

        /* ── PAGE BREAK ── */
        .pdf-page-break {
          page-break-before: always;
          break-before: page;
        }
        .pdf-no-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* ══════════════════════════════════════════════════════════
           HEADER BANNER — Viridian Primary
        ══════════════════════════════════════════════════════════ */
        .rpt-header {
          background: var(--primary);
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          position: relative;
        }
        .rpt-header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--primary-fixed-dim);
        }
        .rpt-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .rpt-header-logo {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
        }
        .rpt-header-identity {
          display: flex;
          flex-direction: column;
        }
        .rpt-header-system {
          font-family: 'Manrope', sans-serif;
          font-size: 18px;
          font-weight: 800;
          line-height: 24px;
          letter-spacing: 0.02em;
          color: var(--on-primary);
          display: block;
        }
        .rpt-header-subtitle {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          color: var(--on-primary-container);
          display: block;
          margin-top: 2px;
        }
        .rpt-header-right {
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .rpt-header-doc-title {
          font-family: 'Manrope', sans-serif;
          font-size: 18px;
          font-weight: 700;
          line-height: 24px;
          color: var(--on-primary);
          display: block;
        }
        .rpt-header-meta {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          color: var(--on-primary-container);
          display: block;
          margin-top: 3px;
        }

        /* ══════════════════════════════════════════════════════════
           INFO BAR — Document metadata
        ══════════════════════════════════════════════════════════ */
        .rpt-info-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid var(--outline-variant);
          border-top: none;
          background: var(--surface-container-low);
          width: 100%;
        }
        .rpt-info-cell {
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .rpt-info-cell + .rpt-info-cell {
          border-left: 1px solid var(--outline-variant);
        }
        .rpt-info-label {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .rpt-info-value {
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 600;
          line-height: 20px;
          color: var(--on-surface);
        }

        /* ══════════════════════════════════════════════════════════
           SECTION — Numbered headers with dividers
        ══════════════════════════════════════════════════════════ */
        .rpt-section {
          margin-top: var(--sp-gap-lg);
          width: 100%;
          padding: 0 24px;
        }
        .rpt-section-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0, 66, 44, 0.20);
        }
        .rpt-section-num {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 800;
          line-height: 16px;
          color: var(--on-primary);
          background: var(--primary-container);
          width: 22px;
          height: 22px;
          border-radius: var(--r-default);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rpt-section-title {
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 700;
          line-height: 20px;
          color: var(--on-surface);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ══════════════════════════════════════════════════════════
           SUMMARY CARDS — Left accent, icon, compact
        ══════════════════════════════════════════════════════════ */
        .rpt-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--sp-gap-md);
          width: 100%;
        }
        .rpt-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--sp-gap-md);
          width: 100%;
        }
        .rpt-card {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          padding: 10px 14px;
          background: var(--surface-container-lowest);
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .rpt-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: var(--outline);
        }
        .rpt-card.accent-income::before { background: var(--primary-container); }
        .rpt-card.accent-expense::before { background: var(--tertiary-container); }
        .rpt-card.accent-neutral::before { background: var(--outline); }
        .rpt-card.accent-info::before { background: var(--primary-fixed-dim); }

        .rpt-card-icon {
          width: 16px;
          height: 16px;
          margin-bottom: 4px;
          flex-shrink: 0;
        }
        .rpt-card-label {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--on-surface-variant);
          display: block;
          margin-bottom: 3px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .rpt-card-value {
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 600;
          line-height: 20px;
          color: var(--on-surface);
          display: block;
        }
        .rpt-card-value.v-income  { color: var(--primary-container); }
        .rpt-card-value.v-expense { color: var(--tertiary-container); }
        .rpt-card-value.v-neutral { color: var(--on-surface); }

        /* ══════════════════════════════════════════════════════════
           DATA TABLES — Primary green header, 1px row borders
        ══════════════════════════════════════════════════════════ */
        .rpt-table-wrap {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          overflow: hidden;
          width: 100%;
        }
        .rpt-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          table-layout: fixed;
        }
        .rpt-table thead tr {
          background: var(--primary-container);
        }
        .rpt-table th {
          color: var(--on-primary);
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          padding: 0.75rem 1rem;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border: none;
        }
        .rpt-table th.tc { text-align: center; }
        .rpt-table th.tr { text-align: right; }
        .rpt-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--surface-container-high);
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          color: var(--on-surface);
          vertical-align: middle;
        }
        .rpt-table td.tc { text-align: center; }
        .rpt-table td.tr { text-align: right; }
        .rpt-table tr:last-child td { border-bottom: none; }
        .rpt-table tr { page-break-inside: avoid; break-inside: avoid; }

        .rpt-table td.td-date {
          text-align: center;
          font-size: 12px;
          font-weight: 400;
          color: var(--on-surface-variant);
        }
        .rpt-table td.td-amount {
          text-align: right;
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 600;
          line-height: 20px;
        }
        .rpt-amount-income  { color: var(--primary-container) !important; font-weight: 700 !important; }
        .rpt-amount-expense { color: var(--tertiary-container) !important; font-weight: 700 !important; }
        .rpt-amount-neutral { color: var(--on-surface) !important; font-weight: 600 !important; }

        .rpt-table tr.row-subtotal td {
          background: var(--surface-container-low);
          font-weight: 700;
          border-top: 1px solid var(--outline-variant);
          border-bottom: none;
          font-size: 12px;
        }
        .rpt-table tr.row-opening td {
          color: var(--outline);
          font-style: italic;
        }
        .rpt-table tr.row-final td {
          font-weight: 800;
          border-top: 2px solid var(--primary-fixed-dim);
          background: var(--surface-container-low);
          border-bottom: none;
          font-size: 13px;
        }

        /* ── CHIP / STATUS BADGE ── */
        .rpt-chip {
          display: inline-block;
          padding: 2px 10px;
          border-radius: var(--r-full);
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          letter-spacing: 0.02em;
          text-align: center;
        }
        .rpt-chip.red {
          background: rgba(164, 0, 25, 0.08);
          color: var(--tertiary-container);
        }
        .rpt-chip.green {
          background: rgba(0, 92, 63, 0.08);
          color: var(--primary-container);
        }

        .rpt-empty {
          text-align: center;
          color: var(--outline);
          font-size: 12px;
          font-style: italic;
          padding: 20px 0;
        }

        /* ══════════════════════════════════════════════════════════
           PENGESAHAN PAGE — Verification blocks, signatures
        ══════════════════════════════════════════════════════════ */
        .rpt-signoff-header {
          text-align: center;
          margin-bottom: var(--sp-gap-lg);
          width: 100%;
          padding: 0 24px;
        }
        .rpt-signoff-label {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
          text-transform: uppercase;
          letter-spacing: 0.10em;
          display: block;
          margin-bottom: 6px;
        }
        .rpt-signoff-title {
          font-family: 'Manrope', sans-serif;
          font-size: 24px;
          font-weight: 800;
          line-height: 32px;
          letter-spacing: 0.02em;
          color: var(--on-surface);
          display: block;
          text-transform: uppercase;
        }
        .rpt-signoff-period {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          color: var(--outline);
          display: block;
          margin-top: 6px;
        }
        .rpt-signoff-rule {
          height: 1px;
          background: rgba(0, 66, 44, 0.20);
          margin: var(--sp-gap-lg) 24px;
          width: calc(100% - 48px);
        }

        /* Verification summary cards */
        .rpt-verif-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--sp-gap-md);
          margin-bottom: var(--sp-gap-lg);
          width: 100%;
          padding: 0 24px;
        }
        .rpt-verif-card {
          border: 1px solid var(--outline-variant);
          border-radius: var(--r-default);
          overflow: hidden;
        }
        .rpt-verif-card-head {
          background: var(--primary-container);
          color: var(--on-primary);
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          padding: 8px 14px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .rpt-verif-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 14px;
          border-bottom: 1px solid var(--surface-container-high);
        }
        .rpt-verif-row:last-child { border-bottom: none; }
        .rpt-verif-row.total {
          background: var(--surface-container-low);
          border-top: 1px solid var(--outline-variant);
        }
        .rpt-verif-k {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          color: var(--on-surface-variant);
        }
        .rpt-verif-v {
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 600;
          line-height: 20px;
          color: var(--on-surface);
        }
        .rpt-verif-v.income  { color: var(--primary-container); }
        .rpt-verif-v.expense { color: var(--tertiary-container); }

        /* Signature section */
        .rpt-sign-section-label {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
          display: block;
          margin-bottom: 14px;
          padding: 0 24px;
        }
        .rpt-sign-grid {
          display: grid;
          grid-template-columns: repeat(2, 220px);
          gap: 24px;
          justify-content: center;
          width: 100%;
          padding: 0 24px;
        }
        .rpt-sign-box {
          text-align: center;
        }
        .rpt-sign-role-label {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: block;
          margin-bottom: 2px;
        }
        .rpt-sign-role-title {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 500;
          line-height: 18px;
          color: var(--on-surface-variant);
          display: block;
          margin-bottom: 10px;
        }
        .rpt-sign-stamp {
          border: 1.5px dashed var(--outline-variant);
          border-radius: var(--r-default);
          min-height: 76px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 12px 8px;
          background: var(--surface-container-low);
          margin-bottom: 10px;
        }
        .rpt-sign-stamp.green-tint {
          border-color: var(--primary-fixed-dim);
          background: #f0fdf7;
        }
        .rpt-sign-icon { width: 24px; height: 24px; }
        .rpt-sign-name {
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 700;
          line-height: 20px;
          color: var(--primary-container);
          display: block;
        }
        .rpt-sign-date {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
          display: block;
        }
        .rpt-sign-underline-name {
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 700;
          line-height: 20px;
          color: var(--on-surface);
          text-decoration: underline;
          text-underline-offset: 3px;
          display: block;
          margin-bottom: 2px;
        }
        .rpt-sign-underline-role {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          color: var(--outline);
          display: block;
        }

        /* ══════════════════════════════════════════════════════════
           FOOTER
        ══════════════════════════════════════════════════════════ */
        .rpt-page-footer {
          text-align: center;
          margin-top: var(--sp-gap-lg);
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
          padding: 0 24px;
          width: 100%;
        }
        .rpt-doc-footer {
          margin-top: 12px;
          padding: 10px 24px 0 24px;
          border-top: 1px solid var(--outline-variant);
          display: flex;
          justify-content: space-between;
          width: 100%;
        }
        .rpt-doc-footer-txt {
          font-family: 'Manrope', sans-serif;
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          color: var(--outline);
        }
      `}} />

      {/* ════════════════════════════════════════════════════════════
          HEADER BANNER — Viridian Primary
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-header">
        <div className="rpt-header-left">
          {/* Logo — Badminton shuttlecock icon, stroke-based 2px */}
          <svg className="rpt-header-logo" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="19" cy="19" r="17" stroke="#a6f3cc" strokeWidth="2" fill="rgba(166,243,204,0.12)"/>
            <path d="M19 8c0 6-4 10-4 14.5a4 4 0 108 0C23 18 19 14 19 8z" stroke="#a6f3cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <line x1="17" y1="15" x2="21" y2="15" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16.5" y1="18" x2="21.5" y2="18" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16.5" y1="21" x2="21.5" y2="21" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="19" cy="27" r="2" stroke="#a6f3cc" strokeWidth="1.5" fill="none"/>
          </svg>
          <div className="rpt-header-identity">
            <span className="rpt-header-system">SI-PATRA</span>
            <span className="rpt-header-subtitle">Sistem Informasi Badminton &amp; Kas</span>
          </div>
        </div>
        <div className="rpt-header-right">
          <span className="rpt-header-doc-title">Laporan Kas Bulanan</span>
          <span className="rpt-header-meta">
            Periode: {periodStr}<br/>
            Dicetak: {formatToday()}
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          INFO BAR — Document metadata
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-info-bar">
        <div className="rpt-info-cell">
          <span className="rpt-info-label">No. Laporan</span>
          <span className="rpt-info-value">{reportCode}</span>
        </div>
        <div className="rpt-info-cell">
          <span className="rpt-info-label">Organisasi</span>
          <span className="rpt-info-value">Komunitas Badminton Dosen UNPAM</span>
        </div>
        <div className="rpt-info-cell">
          <span className="rpt-info-label">Dicetak Oleh</span>
          <span className="rpt-info-value">{profile?.nama ?? '-'}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          01. RINGKASAN KEUANGAN KAS ORGANISASI
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section pdf-no-break">
        <div className="rpt-section-head">
          <span className="rpt-section-num">01</span>
          <span className="rpt-section-title">Ringkasan Keuangan Kas Organisasi</span>
        </div>
        <div className="rpt-grid-4">
          <div className="rpt-card accent-neutral">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="#6f7973" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="rpt-card-label">Saldo Awal</span>
            <span className="rpt-card-value v-neutral">
              {reportData.saldoAwal < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAwal))}
            </span>
          </div>
          <div className="rpt-card accent-income">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M8 4l-3 3M8 4l3 3" stroke="#005c3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="rpt-card-label">Kas Masuk</span>
            <span className="rpt-card-value v-income">
              +{formatRp(Math.abs(reportData.kasMasuk))}
            </span>
          </div>
          <div className="rpt-card accent-expense">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><path d="M8 4v8M8 12l-3-3M8 12l3-3" stroke="#a40019" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="rpt-card-label">Kas Keluar</span>
            <span className="rpt-card-value v-expense">
              -{formatRp(Math.abs(reportData.kasKeluar))}
            </span>
          </div>
          <div className="rpt-card accent-info">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#8ad6b1" strokeWidth="2" fill="none"/><path d="M5 8h6" stroke="#8ad6b1" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="rpt-card-label">Saldo Akhir</span>
            <span className={`rpt-card-value ${reportData.saldoAkhir >= 0 ? 'v-neutral' : 'v-expense'}`}>
              {reportData.saldoAkhir < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAkhir))}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          02. KEUANGAN OPERASIONAL SESI
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section pdf-no-break">
        <div className="rpt-section-head">
          <span className="rpt-section-num">02</span>
          <span className="rpt-section-title">Keuangan Operasional Sesi</span>
        </div>
        <div className="rpt-grid-3">
          <div className="rpt-card accent-income">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M8 4l-3 3M8 4l3 3" stroke="#005c3f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="rpt-card-label">Pendapatan Operasional</span>
            <span className="rpt-card-value v-income">
              +{formatRp(Math.abs(reportData.sessionIncome))}
            </span>
          </div>
          <div className="rpt-card accent-expense">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><path d="M8 4v8M8 12l-3-3M8 12l3-3" stroke="#a40019" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="rpt-card-label">Pengeluaran Sewa Lapangan</span>
            <span className="rpt-card-value v-expense">
              -{reportData.sessionExpense === 0 ? 'Rp 0' : formatRp(Math.abs(reportData.sessionExpense))}
            </span>
          </div>
          <div className="rpt-card accent-info">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#8ad6b1" strokeWidth="2" fill="none"/><path d="M6 8h4" stroke="#8ad6b1" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="rpt-card-label">Surplus / Defisit</span>
            <span className={`rpt-card-value ${reportData.sessionBalance < 0 ? 'v-expense' : 'v-neutral'}`}>
              {reportData.sessionBalance < 0 ? '-' : ''}{formatRp(Math.abs(reportData.sessionBalance))}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          03. STATISTIK SESI & KAS
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section pdf-no-break">
        <div className="rpt-section-head">
          <span className="rpt-section-num">03</span>
          <span className="rpt-section-title">Statistik Sesi &amp; Kas</span>
        </div>
        <div className="rpt-grid-4">
          <div className="rpt-card accent-neutral">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="7" width="3" height="7" rx="1" stroke="#6f7973" strokeWidth="1.5" fill="none"/><rect x="6.5" y="4" width="3" height="10" rx="1" stroke="#6f7973" strokeWidth="1.5" fill="none"/><rect x="11" y="2" width="3" height="12" rx="1" stroke="#6f7973" strokeWidth="1.5" fill="none"/></svg>
            <span className="rpt-card-label">Jumlah Sesi</span>
            <span className="rpt-card-value v-neutral">{reportData.statistics.jumlahSesi}</span>
          </div>
          <div className="rpt-card accent-neutral">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#6f7973" strokeWidth="1.5" fill="none"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#6f7973" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
            <span className="rpt-card-label">Anggota Aktif</span>
            <span className="rpt-card-value v-neutral">{reportData.statistics.jumlahAnggotaAktif}</span>
          </div>
          <div className="rpt-card accent-neutral">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3.5L14 6l-3 2.5.8 4L8 10.5 4.2 12.5l.8-4L2 6l4.5-.5z" stroke="#6f7973" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>
            <span className="rpt-card-label">Total Kehadiran</span>
            <span className="rpt-card-value v-neutral">{reportData.statistics.totalKehadiran}</span>
          </div>
          <div className="rpt-card accent-income">
            <svg className="rpt-card-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#005c3f" strokeWidth="1.5" fill="none"/><path d="M8 5v6M6 7h4" stroke="#005c3f" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span className="rpt-card-label">Total Iuran Kas</span>
            <span className="rpt-card-value v-neutral">
              {formatRp(Math.abs(reportData.statistics.totalIuranKas))}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          04. SUMBER KAS MASUK
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section">
        <div className="rpt-section-head">
          <span className="rpt-section-num">04</span>
          <span className="rpt-section-title">Sumber Kas Masuk</span>
        </div>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                <th className="tc" style={{ width: '20%' }}>Tanggal</th>
                <th style={{ width: '55%' }}>Sesi</th>
                <th className="tr" style={{ width: '25%' }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {reportData.sumberKasMasuk.length === 0 ? (
                <tr><td colSpan={3} className="rpt-empty">Tidak ada kas masuk pada periode ini.</td></tr>
              ) : (
                reportData.sumberKasMasuk.map((s: any) => (
                  <tr key={s.id}>
                    <td className="td-date">{formatDate(s.tanggal)}</td>
                    <td>{s.nama}</td>
                    <td className="td-amount rpt-amount-income">+{formatRp(Math.abs(s.jumlah))}</td>
                  </tr>
                ))
              )}
              <tr className="row-subtotal">
                <td colSpan={2} className="tr" style={{ color: '#3f4943' }}>Subtotal</td>
                <td className="td-amount rpt-amount-income">+{formatRp(Math.abs(reportData.kasMasuk))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          05. PENGELUARAN KAS
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section">
        <div className="rpt-section-head">
          <span className="rpt-section-num">05</span>
          <span className="rpt-section-title">Pengeluaran Kas</span>
        </div>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                <th className="tc" style={{ width: '20%' }}>Tanggal</th>
                <th style={{ width: '35%' }}>Keterangan</th>
                <th className="tc" style={{ width: '20%' }}>Kategori</th>
                <th className="tr" style={{ width: '25%' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {reportData.pengeluaranKas.length === 0 ? (
                <tr><td colSpan={4} className="rpt-empty">Tidak ada pengeluaran pada periode ini.</td></tr>
              ) : (
                reportData.pengeluaranKas.map((e: any) => (
                  <tr key={e.id}>
                    <td className="td-date">{formatDate(e.tanggal)}</td>
                    <td>{e.keterangan}</td>
                    <td className="tc">
                      <span className="rpt-chip red">{e.kategori}</span>
                    </td>
                    <td className="td-amount rpt-amount-expense">-{formatRp(Math.abs(e.nominal))}</td>
                  </tr>
                ))
              )}
              <tr className="row-subtotal">
                <td colSpan={3} className="tr" style={{ color: '#3f4943' }}>Subtotal</td>
                <td className="td-amount rpt-amount-expense">-{formatRp(Math.abs(reportData.kasKeluar))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          06. SALDO BERJALAN (LEDGER)
      ════════════════════════════════════════════════════════════ */}
      <div className="rpt-section">
        <div className="rpt-section-head">
          <span className="rpt-section-num">06</span>
          <span className="rpt-section-title">Saldo Berjalan (Ledger)</span>
        </div>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                <th className="tc" style={{ width: '18%' }}>Tanggal</th>
                <th style={{ width: '34%' }}>Keterangan</th>
                <th className="tr" style={{ width: '16%' }}>Masuk</th>
                <th className="tr" style={{ width: '16%' }}>Keluar</th>
                <th className="tr" style={{ width: '16%' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-opening">
                <td className="td-date">-</td>
                <td>Saldo Awal Periode</td>
                <td className="tr">-</td>
                <td className="tr">-</td>
                <td className="td-amount rpt-amount-neutral">
                  {formatRp(Math.abs(reportData.saldoAwal))}
                </td>
              </tr>
              {reportData.ledger.length === 0 ? (
                <tr><td colSpan={5} className="rpt-empty">Tidak ada transaksi tercatat.</td></tr>
              ) : (
                reportData.ledger.map((row: any, idx: number) => (
                  <tr key={idx}>
                    <td className="td-date">{formatDate(row.tanggal)}</td>
                    <td>{row.keterangan}</td>
                    <td className={`td-amount ${row.masuk > 0 ? 'rpt-amount-income' : ''}`} style={{ color: row.masuk > 0 ? undefined : '#6f7973' }}>
                      {row.masuk > 0 ? '+' + formatRp(Math.abs(row.masuk)) : '-'}
                    </td>
                    <td className={`td-amount ${row.keluar > 0 ? 'rpt-amount-expense' : ''}`} style={{ color: row.keluar > 0 ? undefined : '#6f7973' }}>
                      {row.keluar > 0 ? '-' + formatRp(Math.abs(row.keluar)) : '-'}
                    </td>
                    <td className="td-amount rpt-amount-neutral">
                      {formatRp(Math.abs(row.saldo))}
                    </td>
                  </tr>
                ))
              )}
              <tr className="row-final">
                <td colSpan={4} className="tr" style={{ color: '#3f4943' }}>Saldo Akhir Periode:</td>
                <td className={`td-amount ${reportData.saldoAkhir >= 0 ? 'rpt-amount-neutral' : 'rpt-amount-expense'}`}>
                  {formatRp(Math.abs(reportData.saldoAkhir))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Page 1 footer */}
      <div className="rpt-page-footer">Halaman 1 dari 2</div>

      {/* ════════════════════════════════════════════════════════════
          PAGE 2 — PENGESAHAN
      ════════════════════════════════════════════════════════════ */}
      <div className="pdf-page-break">

        {/* Re-print compact header on page 2 */}
        <div className="rpt-header" style={{ padding: '14px 24px' }}>
          <div className="rpt-header-left">
            <svg className="rpt-header-logo" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '30px', height: '30px' }}>
              <circle cx="19" cy="19" r="17" stroke="#a6f3cc" strokeWidth="2" fill="rgba(166,243,204,0.12)"/>
              <path d="M19 8c0 6-4 10-4 14.5a4 4 0 108 0C23 18 19 14 19 8z" stroke="#a6f3cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <line x1="17" y1="15" x2="21" y2="15" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="16.5" y1="18" x2="21.5" y2="18" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="16.5" y1="21" x2="21.5" y2="21" stroke="#a6f3cc" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="19" cy="27" r="2" stroke="#a6f3cc" strokeWidth="1.5" fill="none"/>
            </svg>
            <div className="rpt-header-identity">
              <span className="rpt-header-system" style={{ fontSize: '14px', lineHeight: '20px' }}>SI-PATRA</span>
              <span className="rpt-header-subtitle" style={{ fontSize: '11px' }}>Sistem Informasi Badminton &amp; Kas</span>
            </div>
          </div>
          <div className="rpt-header-right">
            <span className="rpt-header-doc-title" style={{ fontSize: '14px', lineHeight: '20px' }}>Halaman Pengesahan</span>
            <span className="rpt-header-meta" style={{ fontSize: '11px' }}>No. {reportCode}</span>
          </div>
        </div>

        {/* Title */}
        <div className="rpt-signoff-header" style={{ marginTop: '24px' }}>
          <span className="rpt-signoff-label">Dokumen Resmi — Komunitas Badminton Dosen UNPAM</span>
          <span className="rpt-signoff-title">Laporan Keuangan Kas Bulanan</span>
          <span className="rpt-signoff-period">Periode: {periodStr}</span>
        </div>

        <div className="rpt-signoff-rule" />

        {/* Verification summary cards */}
        <div className="rpt-verif-grid">
          <div className="rpt-verif-card">
            <div className="rpt-verif-card-head">Ringkasan Verifikasi Kas</div>
            <div className="rpt-verif-row">
              <span className="rpt-verif-k">Saldo Awal</span>
              <span className="rpt-verif-v">{formatRp(Math.abs(reportData.saldoAwal))}</span>
            </div>
            <div className="rpt-verif-row">
              <span className="rpt-verif-k">+ Kas Masuk</span>
              <span className="rpt-verif-v income">+{formatRp(Math.abs(reportData.kasMasuk))}</span>
            </div>
            <div className="rpt-verif-row">
              <span className="rpt-verif-k">- Kas Keluar</span>
              <span className="rpt-verif-v expense">-{formatRp(Math.abs(reportData.kasKeluar))}</span>
            </div>
            <div className="rpt-verif-row total">
              <span className="rpt-verif-k" style={{ color: '#1b1c1c', fontWeight: 700 }}>Saldo Akhir</span>
              <span className={`rpt-verif-v ${reportData.saldoAkhir >= 0 ? '' : 'expense'}`} style={{ fontWeight: 800 }}>
                {formatRp(Math.abs(reportData.saldoAkhir))}
              </span>
            </div>
          </div>
          <div className="rpt-verif-card">
            <div className="rpt-verif-card-head">Ringkasan Operasional Sesi</div>
            <div className="rpt-verif-row">
              <span className="rpt-verif-k">Jumlah Sesi</span>
              <span className="rpt-verif-v">{reportData.statistics.jumlahSesi} sesi</span>
            </div>
            <div className="rpt-verif-row">
              <span className="rpt-verif-k">Anggota Aktif</span>
              <span className="rpt-verif-v">{reportData.statistics.jumlahAnggotaAktif} orang</span>
            </div>
            <div className="rpt-verif-row">
              <span className="rpt-verif-k">Total Kehadiran</span>
              <span className="rpt-verif-v">{reportData.statistics.totalKehadiran} hadir</span>
            </div>
            <div className="rpt-verif-row total">
              <span className="rpt-verif-k" style={{ color: '#1b1c1c', fontWeight: 700 }}>Surplus / Defisit Sesi</span>
              <span className={`rpt-verif-v ${reportData.sessionBalance < 0 ? 'expense' : ''}`} style={{ fontWeight: 800 }}>
                {reportData.sessionBalance < 0 ? '-' : '+'}{formatRp(Math.abs(reportData.sessionBalance))}
              </span>
            </div>
          </div>
        </div>

        <div className="rpt-signoff-rule" />

        {/* Signatures */}
        <span className="rpt-sign-section-label">Tanda Tangan &amp; Pengesahan Dokumen</span>
        <div className="rpt-sign-grid">
          <div className="rpt-sign-box">
            <span className="rpt-sign-role-label">Disetujui Oleh</span>
            <span className="rpt-sign-role-title">Ketua / Superadmin</span>
            <div className="rpt-sign-stamp green-tint">
              <svg className="rpt-sign-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#a6f3cc"/>
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#005c3f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="rpt-sign-name">{superadminName}</span>
              <span className="rpt-sign-date">30 {monthName} {selectedYear}</span>
            </div>
            <span className="rpt-sign-underline-name">{superadminName}</span>
            <span className="rpt-sign-underline-role">Ketua / Superadmin</span>
          </div>
          <div className="rpt-sign-box">
            <span className="rpt-sign-role-label">Dibuat Oleh</span>
            <span className="rpt-sign-role-title">Bendahara Organisasi</span>
            <div className="rpt-sign-stamp green-tint">
              <svg className="rpt-sign-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#a6f3cc"/>
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#005c3f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="rpt-sign-name">{bendaharaName}</span>
              <span className="rpt-sign-date">30 {monthName} {selectedYear}</span>
            </div>
            <span className="rpt-sign-underline-name">{bendaharaName}</span>
            <span className="rpt-sign-underline-role">Bendahara Organisasi</span>
          </div>
        </div>

        {/* Page 2 footer */}
        <div className="rpt-page-footer" style={{ marginTop: '28px' }}>Halaman 2 dari 2</div>

        {/* Document footer */}
        <div className="rpt-doc-footer">
          <span className="rpt-doc-footer-txt">SI-PATRA © {selectedYear} · {reportCode} · Dokumen Resmi &amp; Rahasia</span>
          <span className="rpt-doc-footer-txt">Digenerate otomatis oleh Sistem Informasi Badminton &amp; Kas</span>
        </div>

      </div>{/* end page-break */}
    </div>
  );
};
