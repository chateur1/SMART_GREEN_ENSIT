import React from 'react';
import { usePeriode } from '../../hooks/usePeriode';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

/* ─── Design System : tokens globaux injectés une fois ─── */
const DS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --brand-900: #0d2106;
    --brand-800: #162d08;
    --brand-700: #1e3f0b;
    --brand-600: #27520e;
    --brand-500: #336b12;
    --brand-400: #4a9119;
    --brand-300: #6db82c;
    --brand-200: #a8d97a;
    --brand-100: #d6efc0;
    --brand-50:  #eef8e3;

    --neutral-950: #0a0a09;
    --neutral-900: #111110;
    --neutral-800: #1c1c1a;
    --neutral-700: #2e2e2b;
    --neutral-600: #44443f;
    --neutral-500: #636360;
    --neutral-400: #888884;
    --neutral-300: #b3b3ae;
    --neutral-200: #d4d4cf;
    --neutral-100: #ebebea;
    --neutral-50:  #f7f7f6;
    --neutral-0:   #ffffff;

    --accent-blue:   #1d6fb8;
    --accent-amber:  #c47d18;
    --accent-red:    #b93232;
    --accent-violet: #5b4fcf;

    --surface-0: #ffffff;
    --surface-1: #f7f7f6;
    --surface-2: #f0f0ef;
    --surface-border: #e4e4e2;

    --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-sm: 0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);

    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;

    --sidebar-w: 248px;
    --topbar-h: 56px;

    --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'DM Mono', 'Fira Code', monospace;

    --transition: 180ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 15px; -webkit-font-smoothing: antialiased; }

  body {
    font-family: var(--font-sans);
    background: var(--surface-1);
    color: var(--neutral-900);
    line-height: 1.5;
  }

  /* ── Scrollbar raffinée ── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--neutral-200); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--neutral-300); }

  /* ── Layout principal ── */
  .app-shell { display: flex; min-height: 100vh; }

  /* ════════════════════════════════════
     SIDEBAR
  ════════════════════════════════════ */
  .sidebar {
    width: var(--sidebar-w);
    min-height: 100vh;
    background: var(--brand-900);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 100;
    border-right: 1px solid rgba(255,255,255,0.04);
  }

  /* Logo */
  .sidebar-logo {
    padding: 20px 18px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; gap: 10px;
  }
  .logo-icon {
    width: 34px; height: 34px; border-radius: 9px;
    background: linear-gradient(135deg, var(--brand-400), var(--brand-300));
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(106,185,43,0.35);
  }
  .logo-text { flex: 1; min-width: 0; }
  .logo-name {
    color: #fff; font-size: 14px; font-weight: 700;
    letter-spacing: -0.2px; white-space: nowrap;
  }
  .logo-tagline {
    color: rgba(255,255,255,0.38); font-size: 11px;
    font-weight: 400; margin-top: 1px;
  }

  /* Status badge */
  .sidebar-status {
    margin: 12px 18px;
    padding: 6px 10px;
    background: rgba(109,184,44,0.12);
    border: 1px solid rgba(109,184,44,0.2);
    border-radius: var(--radius-sm);
    display: flex; align-items: center; gap: 7px;
    font-size: 11px; color: var(--brand-200);
  }
  .status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--brand-300);
    box-shadow: 0 0 0 2px rgba(109,184,44,0.25);
    animation: pulse-dot 2.4s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { box-shadow: 0 0 0 2px rgba(109,184,44,0.25); }
    50% { box-shadow: 0 0 0 4px rgba(109,184,44,0.1); }
  }

  /* Navigation */
  .sidebar-nav { flex: 1; padding: 8px 12px; overflow-y: auto; }

  .nav-section { margin-bottom: 4px; }
  .nav-section-label {
    padding: 12px 8px 6px;
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.8px;
    color: rgba(255,255,255,0.25);
  }

  .nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    color: rgba(255,255,255,0.55);
    text-decoration: none;
    font-size: 13.5px; font-weight: 450;
    transition: all var(--transition);
    margin-bottom: 1px;
    position: relative;
  }
  .nav-item:hover {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.88);
  }
  .nav-item.active {
    background: rgba(109,184,44,0.14);
    color: var(--brand-200);
    font-weight: 550;
  }
  .nav-item.active::before {
    content: '';
    position: absolute; left: 0; top: 50%;
    transform: translateY(-50%);
    width: 3px; height: 18px;
    background: var(--brand-300);
    border-radius: 0 3px 3px 0;
    box-shadow: 0 0 8px rgba(109,184,44,0.5);
  }
  .nav-icon {
    width: 20px; height: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0; opacity: 0.85;
  }
  .nav-label { flex: 1; line-height: 1.2; }

  /* Nav scope badges */
  .nav-scope-badge {
    font-size: 9px; font-weight: 700;
    padding: 1px 5px; border-radius: 4px;
    letter-spacing: 0.3px; text-transform: uppercase;
  }
  .scope1-b { background: rgba(185,50,50,0.25); color: #ff8a8a; }
  .scope2-b { background: rgba(29,111,184,0.25); color: #7ab8f5; }
  .scope3-b { background: rgba(91,79,207,0.25); color: #b3a6ff; }

  /* User block */
  .sidebar-user {
    margin: 0 12px 12px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: var(--radius-md);
    display: flex; align-items: center; gap: 9px;
    cursor: pointer;
    transition: background var(--transition);
  }
  .sidebar-user:hover { background: rgba(255,255,255,0.07); }
  .user-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, var(--brand-500), var(--brand-400));
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .user-info { flex: 1; min-width: 0; }
  .user-name {
    font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.85);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .user-role { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 1px; }
  .user-logout {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.3); font-size: 14px;
    transition: all var(--transition);
  }
  .user-logout:hover { background: rgba(255,60,60,0.15); color: #ff8080; }

  /* ════════════════════════════════════
     MAIN CONTENT
  ════════════════════════════════════ */
  .main-area {
    flex: 1;
    margin-left: var(--sidebar-w);
    display: flex; flex-direction: column;
    min-width: 0; min-height: 100vh;
  }

  /* Topbar */
  .topbar {
    height: var(--topbar-h);
    background: var(--surface-0);
    border-bottom: 1px solid var(--surface-border);
    padding: 0 28px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 50;
    box-shadow: var(--shadow-xs);
  }
  .topbar-left { display: flex; align-items: center; gap: 14px; }
  .breadcrumb {
    font-size: 13px; color: var(--neutral-400);
    display: flex; align-items: center; gap: 6px;
  }
  .breadcrumb-sep { color: var(--neutral-300); }
  .breadcrumb-current { color: var(--neutral-700); font-weight: 550; }
  .topbar-right { display: flex; align-items: center; gap: 10px; }
  .topbar-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 11px;
    background: var(--surface-1);
    border: 1px solid var(--surface-border);
    border-radius: 99px; font-size: 12px;
    color: var(--neutral-500); font-weight: 450;
  }
  .topbar-period {
    padding: 5px 11px;
    background: var(--brand-50);
    border: 1px solid var(--brand-100);
    border-radius: 99px; font-size: 12px;
    color: var(--brand-600); font-weight: 600;
  }

  /* Page content */
  .page-area { flex: 1; padding: 28px 32px; max-width: 1400px; width: 100%; margin: 0 auto; }

  /* ════════════════════════════════════
     COMPOSANTS UI GLOBAUX
  ════════════════════════════════════ */

  /* Page header */
  .pg-header { margin-bottom: 28px; }
  .pg-title {
    font-size: 22px; font-weight: 700;
    color: var(--neutral-950); letter-spacing: -0.4px; line-height: 1.2;
  }
  .pg-subtitle {
    font-size: 13.5px; color: var(--neutral-400);
    margin-top: 5px; line-height: 1.5;
  }
  .pg-header-row {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 16px;
  }

  /* Cards */
  .card {
    background: var(--surface-0);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xs);
  }
  .card-pad { padding: 22px 24px; }
  .card-header {
    padding: 16px 22px;
    border-bottom: 1px solid var(--surface-border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-title {
    font-size: 14px; font-weight: 650;
    color: var(--neutral-800); letter-spacing: -0.1px;
    display: flex; align-items: center; gap: 8px;
  }
  .card-icon {
    width: 24px; height: 24px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; background: var(--surface-1);
  }
  .card-body { padding: 20px 22px; }

  /* KPI cards */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
  .kpi-card {
    background: var(--surface-0);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    padding: 18px 20px;
    box-shadow: var(--shadow-xs);
    position: relative; overflow: hidden;
    transition: box-shadow var(--transition), transform var(--transition);
  }
  .kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .kpi-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--kpi-accent, var(--brand-300));
  }
  .kpi-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.6px; color: var(--neutral-400); margin-bottom: 10px;
  }
  .kpi-value {
    font-size: 26px; font-weight: 750; color: var(--neutral-950);
    letter-spacing: -0.8px; line-height: 1; margin-bottom: 4px;
    font-family: var(--font-mono);
  }
  .kpi-unit { font-size: 13px; font-weight: 400; color: var(--neutral-400); margin-left: 3px; }
  .kpi-meta { font-size: 12px; color: var(--neutral-400); margin-top: 6px; }
  .kpi-trend {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 600; padding: 2px 7px;
    border-radius: 99px; margin-top: 8px;
  }
  .kpi-trend.down { background: #eaf7e4; color: #2d7a1a; }
  .kpi-trend.up   { background: #fceee8; color: #b93232; }
  .kpi-trend.flat { background: var(--surface-1); color: var(--neutral-400); }

  /* Scope bars */
  .scope-bar-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 20px; }
  .scope-bar-card {
    background: var(--surface-0);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    box-shadow: var(--shadow-xs);
  }
  .scope-bar-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .scope-bar-label { font-size: 11.5px; color: var(--neutral-500); font-weight: 500; }
  .scope-bar-pct {
    font-size: 11px; font-weight: 700; padding: 2px 7px;
    border-radius: 99px;
  }
  .scope-bar-value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; font-family: var(--font-mono); margin-bottom: 10px; }
  .scope-bar-track {
    height: 5px; background: var(--surface-2);
    border-radius: 99px; overflow: hidden;
  }
  .scope-bar-fill {
    height: 100%; border-radius: 99px;
    transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
  }

  /* Charts grid */
  .charts-grid { display: grid; grid-template-columns: 360px 1fr; gap: 16px; margin-bottom: 20px; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: var(--radius-md);
    font-size: 13.5px; font-weight: 600; cursor: pointer;
    border: none; transition: all var(--transition); font-family: var(--font-sans);
    text-decoration: none; white-space: nowrap;
  }
  .btn-primary {
    background: var(--brand-500); color: #fff;
    box-shadow: 0 1px 3px rgba(51,107,18,0.3);
  }
  .btn-primary:hover { background: var(--brand-600); box-shadow: 0 3px 10px rgba(51,107,18,0.35); transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .btn-secondary {
    background: var(--surface-0); color: var(--neutral-700);
    border: 1px solid var(--surface-border);
    box-shadow: var(--shadow-xs);
  }
  .btn-secondary:hover { background: var(--surface-1); border-color: var(--neutral-200); }
  .btn-blue { background: var(--accent-blue); color: #fff; box-shadow: 0 1px 3px rgba(29,111,184,0.3); }
  .btn-blue:hover { background: #1860a2; transform: translateY(-1px); }
  .btn-sm { padding: 6px 13px; font-size: 12.5px; }
  .btn-lg { padding: 12px 24px; font-size: 14.5px; }
  .btn-full { width: 100%; justify-content: center; }

  /* Form inputs */
  .field { margin-bottom: 16px; }
  .field-label {
    display: block; font-size: 12.5px; font-weight: 600;
    color: var(--neutral-600); margin-bottom: 6px; letter-spacing: 0.1px;
  }
  .field-hint { font-size: 11.5px; color: var(--neutral-400); margin-top: 4px; }
  .input {
    width: 100%; padding: 9px 12px;
    border: 1.5px solid var(--surface-border);
    border-radius: var(--radius-md);
    font-size: 14px; font-family: var(--font-sans);
    color: var(--neutral-900); background: var(--surface-0);
    transition: border-color var(--transition), box-shadow var(--transition);
    outline: none;
  }
  .input:hover { border-color: var(--neutral-300); }
  .input:focus { border-color: var(--brand-400); box-shadow: 0 0 0 3px rgba(74,145,25,0.1); }
  .input-number { font-family: var(--font-mono); font-size: 14px; }
  select.input { cursor: pointer; }

  /* Grid layouts */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
  .col-2 { grid-column: span 2; }

  /* Result display */
  .result-panel {
    background: linear-gradient(135deg, var(--brand-50) 0%, #f0f8e8 100%);
    border: 1px solid var(--brand-100);
    border-radius: var(--radius-lg);
    padding: 20px 24px;
    margin-top: 16px;
  }
  .result-panel.blue {
    background: linear-gradient(135deg, #e8f3fd 0%, #deeef9 100%);
    border-color: #c0d9f0;
  }
  .result-value {
    font-size: 36px; font-weight: 750; color: var(--brand-700);
    letter-spacing: -1.2px; line-height: 1; font-family: var(--font-mono);
  }
  .result-value.blue { color: var(--accent-blue); }
  .result-unit { font-size: 16px; font-weight: 400; color: var(--brand-500); margin-left: 4px; }
  .result-label { font-size: 12.5px; color: var(--brand-600); margin-top: 5px; font-weight: 500; }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 99px;
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.1px;
  }
  .badge-green  { background: var(--brand-50);   color: var(--brand-600);   border: 1px solid var(--brand-100); }
  .badge-blue   { background: #e6f1fb;             color: var(--accent-blue); border: 1px solid #bcd8f5; }
  .badge-amber  { background: #faeeda;             color: var(--accent-amber);border: 1px solid #f5d28a; }
  .badge-red    { background: #fceee8;             color: var(--accent-red);  border: 1px solid #f5c4b5; }
  .badge-violet { background: #eeedfe;             color: var(--accent-violet);border: 1px solid #d3cffc; }
  .badge-neutral{ background: var(--surface-1);   color: var(--neutral-500); border: 1px solid var(--surface-border); }

  /* Section divider */
  .section-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 20px 0; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.8px; color: var(--neutral-300);
  }
  .section-divider::before, .section-divider::after {
    content: ''; flex: 1; height: 1px; background: var(--surface-border);
  }

  /* Info/alert boxes */
  .info-box {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 11px 14px; border-radius: var(--radius-md);
    font-size: 13px; margin-bottom: 16px; line-height: 1.5;
  }
  .info-box-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
  .info-blue  { background: #e8f3fd; border: 1px solid #bcd8f5; color: #0d3f6e; }
  .info-green { background: var(--brand-50); border: 1px solid var(--brand-100); color: var(--brand-800); }
  .info-amber { background: #faeeda; border: 1px solid #f5d28a; color: #4a2e00; }

  /* Recommendation cards */
  .reco-card {
    border-radius: var(--radius-md);
    padding: 14px 16px;
    background: var(--surface-0);
    border: 1px solid var(--surface-border);
    transition: box-shadow var(--transition);
    position: relative; overflow: hidden;
  }
  .reco-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--reco-color, var(--brand-300));
  }
  .reco-card:hover { box-shadow: var(--shadow-md); }
  .reco-title { font-size: 13.5px; font-weight: 650; color: var(--neutral-800); margin-bottom: 5px; }
  .reco-desc { font-size: 12.5px; color: var(--neutral-500); line-height: 1.55; }
  .reco-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
  .reco-saving { font-size: 12px; font-weight: 700; color: var(--brand-500); }

  /* Table */
  .data-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .data-table th {
    text-align: left; padding: 10px 14px;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--neutral-400); background: var(--surface-1);
    border-bottom: 1px solid var(--surface-border);
  }
  .data-table td {
    padding: 11px 14px; border-bottom: 1px solid var(--surface-border);
    color: var(--neutral-700);
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:hover td { background: var(--surface-1); }
  .data-table .mono { font-family: var(--font-mono); font-size: 13px; }

  /* Slider custom */
  input[type=range] {
    -webkit-appearance: none; width: 100%; height: 5px;
    border-radius: 99px; background: var(--surface-2);
    outline: none; cursor: pointer;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 18px; height: 18px;
    border-radius: 50%; background: var(--brand-500);
    border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    transition: all var(--transition);
  }
  input[type=range]::-webkit-slider-thumb:hover {
    transform: scale(1.15); box-shadow: 0 2px 8px rgba(51,107,18,0.3);
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .kpi-grid { grid-template-columns: repeat(2,1fr); }
    .charts-grid { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
    .col-2 { grid-column: span 1; }
  }
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); }
    .main-area { margin-left: 0; }
    .page-area { padding: 16px; }
    .kpi-grid { grid-template-columns: 1fr 1fr; }
    .scope-bar-grid { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr; }
  }
`;

const NAV = [
  { section: 'Vue d\'ensemble', items: [
    { to: '/tableau-de-bord', icon: '◈', label: 'Tableau de bord', badge: null },
  ]},
  { section: 'Collecte de données', items: [
    { to: '/saisie/scope1', icon: '◉', label: 'Émissions directes', badge: { text: 'S1', cls: 'scope1-b' } },
    { to: '/saisie/scope2', icon: '◉', label: 'Énergie indirecte', badge: { text: 'S2', cls: 'scope2-b' } },
    { to: '/saisie/enquete-mobilite', icon: '◉', label: 'Mobilité campus', badge: { text: 'S3', cls: 'scope3-b' } },
  ]},
  { section: 'Analyse & Prédiction', items: [
    { to: '/analyse-ia', icon: '◆', label: 'Analyse IA', badge: null },
    { to: '/scenarios', icon: '◆', label: 'Simulation', badge: null },
  ]},
  { section: 'Rapports', items: [
    { to: '/rapports', icon: '▣', label: 'Export & Rapports', badge: null },
  ]},
  { section: 'Mon espace', items: [
    { to: '/empreinte-personnelle', icon: '🌿', label: 'Mon empreinte carbone', badge: null },
  ]},
  { section: 'Administration', items: [
    { to: '/comptes', icon: '◎', label: 'Gestion des comptes', badge: null, adminOnly: true },
  ]},
];

const PAGE_TITLES = {
  '/tableau-de-bord': 'Tableau de bord',
  '/saisie/scope1': 'Scope 1 — Émissions directes',
  '/saisie/scope2': 'Scope 2 — Énergie indirecte',
  '/saisie/enquete-mobilite': 'Scope 3 — Mobilité',
  '/analyse-ia': 'Analyse par IA',
  '/scenarios': 'Scénarios de simulation',
  '/rapports': 'Export & Rapports',
  '/comptes': 'Gestion des comptes',
  '/empreinte-personnelle': 'Mon empreinte carbone',
};

const ROLES = { admin: 'Administrateur', manager: 'Gestionnaire', viewer: 'Lecteur' };

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}

export default function Layout() {
  const { utilisateur, deconnexion } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { periode, annee_debut, annee_fin } = usePeriode();

  const handleDeconnexion = () => {
    deconnexion();
    toast.success('Session terminée');
    navigate('/connexion');
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'Smart Green ENSIT';

  return (
    <>
      <style>{DS}</style>
      <div className="app-shell">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">🌿</div>
            <div className="logo-text">
              <div className="logo-name">Smart Green</div>
              <div className="logo-tagline">Carbon Intelligence Platform</div>
            </div>
          </div>

          <div className="sidebar-status">
            <div className="status-dot" />
            <span>Données {periode} · Actif</span>
          </div>

          <nav className="sidebar-nav">
            {NAV.map(section => (
              <div key={section.section} className="nav-section">
                <div className="nav-section-label">{section.section}</div>
                {section.items.filter(item => !item.adminOnly || utilisateur?.role === 'admin').map(item => (
                  <NavLink
                    key={item.to} to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`nav-scope-badge ${item.badge.cls}`}>{item.badge.text}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-user">
            <div className="user-avatar">{initials(utilisateur?.nomComplet || utilisateur?.email)}</div>
            <div className="user-info">
              <div className="user-name">{utilisateur?.nomComplet || utilisateur?.email}</div>
              <div className="user-role">{ROLES[utilisateur?.role] || utilisateur?.role}</div>
            </div>
            {/* FIX BUG 15: clic uniquement sur le bouton, pas tout le bloc */}
            <button className="user-logout" title="Se déconnecter" onClick={handleDeconnexion}>↩</button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <div className="breadcrumb">
                <span>ENSIT</span>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">{pageTitle}</span>
              </div>
            </div>
            <div className="topbar-right">
              <div className="topbar-pill">
                <span>📋</span>
                <span>GHG Protocol · ADEME Base Carbone</span>
              </div>
              <div className="topbar-period">{annee_debut} – {annee_fin}</div>
            </div>
          </header>

          <main className="page-area">
            <Outlet />
          </main>
        </div>

      </div>
    </>
  );
}
