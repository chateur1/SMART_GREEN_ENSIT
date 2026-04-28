import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import { ia } from '../api/client';
import { usePeriode } from '../hooks/usePeriode';
import toast from 'react-hot-toast';

// Données bilan — les ICP sont recalculés sur la population réelle ENSIT
// via le hook usePeriode qui charge /config/periode
const BILAN_BASE = {
  total_tco2e: 1284,
  vs_annee_prec: -0.8,
  scope1: { total_tco2e: 193, combustion: 135.2, vehicules: 37.8, frigorigenes: 20.0 },
  scope2: { total_tco2e: 809 },
  scope3: { total_tco2e: 282 },
};

// ICP calculés sur données réelles : 1300 étudiants, 11100 m², 13 entités
function calculerICP(total, campus) {
  if (!campus) return { par_etudiant: 0.9877, par_m2: 0.1157, par_entite: 98.77 };
  return {
    par_etudiant: +(total / campus.nb_etudiants_total).toFixed(4),
    par_m2:       +(total / campus.surface_campus_m2).toFixed(4),
    par_entite:   +(total / campus.nb_entites_total).toFixed(2),
  };
}

// Données historiques — les valeurs seront remplacées par les vraies données
// Les années sont calculées dynamiquement depuis la configuration
const DONNEES_HISTO_BASE = [
  { s1: 210, s2: 830, s3: 245, total: 1285 },
  { s1: 205, s2: 820, s3: 260, total: 1285 },
  { s1: 195, s2: 805, s3: 270, total: 1270 },
  { s1: 190, s2: 812, s3: 278, total: 1280 },
  { s1: 193, s2: 809, s3: 282, total: 1284 },
];

const PIE_DATA = [
  { name: 'Scope 1', value: 193,  fill: '#b93232', pct: 15.0 },
  { name: 'Scope 2', value: 809,  fill: '#1d6fb8', pct: 63.0 },
  { name: 'Scope 3', value: 282,  fill: '#5b4fcf', pct: 22.0 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'#fff', border:'1px solid #e4e4e2', borderRadius:10,
      padding:'12px 16px', fontSize:13, boxShadow:'0 8px 24px rgba(0,0,0,0.1)',
    }}>
      <div style={{fontWeight:700, marginBottom:8, color:'#111110'}}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:p.fill||p.color,flexShrink:0}}/>
          <span style={{color:'#636360'}}>{p.name}</span>
          <strong style={{marginLeft:'auto',paddingLeft:12,fontFamily:'DM Mono,monospace'}}>
            {p.value?.toLocaleString('fr-FR')} tCO₂e
          </strong>
        </div>
      ))}
    </div>
  );
};

export default function TableauDeBord() {
  const [iaData, setIaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { annee_debut, annee_fin, historique: annees, campus } = usePeriode();
  const total = BILAN_BASE.total_tco2e;
  const icp   = calculerICP(total, campus);
  const BILAN = { ...BILAN_BASE, icp };

  // Construire l'historique avec les années dynamiques
  const HISTO = annees
    ? DONNEES_HISTO_BASE.map((d, i) => ({ an: String(annees[i] || annee_fin - 4 + i), ...d }))
    : DONNEES_HISTO_BASE.map((d, i) => ({ an: String(2021 + i), ...d }));

  useEffect(() => {
    ia.analyseDemo()
      .then(r => setIaData(r.data))
      .catch(() => toast.error('Analyse IA indisponible'))
      .finally(() => setLoading(false));
  }, []);

  const scopePct = (v) => ((v / total) * 100).toFixed(1);

  return (
    <div>
      {/* Header */}
      <div className="pg-header">
        <div className="pg-header-row">
          <div>
            <h1 className="pg-title">Bilan Carbone — Vue d'ensemble</h1>
            <p className="pg-subtitle">
              Émissions GES · Campus ENSIT · Protocole GHG · Facteurs ADEME Base Carbone
            </p>
          </div>
          <div style={{display:'flex',gap:8}}>
            {/* FIX BUG 16: boutons fonctionnels */}
            <a href="/rapports" style={{textDecoration:'none'}}>
              <button className="btn btn-secondary btn-sm">↓ Exporter</button>
            </a>
            <button className="btn btn-primary btn-sm"
              onClick={() => window.location.reload()}>
              ↻ Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        {[
          {
            label: 'Émissions totales', value: total.toLocaleString('fr-FR'),
            unit: 'tCO₂e', meta: 'Campus complet — Scopes 1, 2 & 3',
            trend: { dir: 'down', val: '−0.8%' }, accent: '#336b12',
          },
          {
            label: 'ICP / Étudiant', value: (BILAN.icp.par_etudiant ?? 0).toFixed(3),
            unit: 'tCO₂e/étu.', meta: `Base : ${campus?.nb_etudiants_total?.toLocaleString('fr-FR') || '1 300'} étudiants`,
            trend: { dir: 'flat', val: 'Stable' }, accent: '#1d6fb8',
          },
          {
            label: 'ICP / Surface', value: (BILAN.icp.par_m2 ?? 0).toFixed(4),
            unit: 'tCO₂e/m²', meta: `Surface : ${campus?.surface_campus_m2?.toLocaleString('fr-FR') || '11 100'} m²`,
            trend: { dir: 'down', val: '−1.2%' }, accent: '#c47d18',
          },
          {
            label: 'ICP / Entité', value: (BILAN.icp.par_entite ?? 0).toFixed(1),
            unit: 'tCO₂e/ent.', meta: `${campus?.nb_entites_total || 13} entités (${campus?.nb_departements || 6} dépt. + ${campus?.nb_structures_recherche || 7} labos)`,
            trend: { dir: 'up', val: '+0.5%' }, accent: '#5b4fcf',
          },
        ].map((k, i) => (
          <div className="kpi-card" key={i} style={{'--kpi-accent': k.accent}}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">
              {k.value}
              <span className="kpi-unit">{k.unit}</span>
            </div>
            <div className="kpi-meta">{k.meta}</div>
            <div className={`kpi-trend ${k.trend.dir}`}>
              {k.trend.dir === 'down' ? '↓' : k.trend.dir === 'up' ? '↑' : '→'} {k.trend.val} vs N−1
            </div>
          </div>
        ))}
      </div>

      {/* Scope bars */}
      <div className="scope-bar-grid">
        {[
          { label: 'Scope 1 · Émissions directes', sublabel: 'Combustion · Véhicules · Frigorigènes',
            value: BILAN.scope1.total_tco2e, color: '#b93232', bg: '#fceee8',
            pctColor: '#b93232', pctBg: '#fceee8' },
          { label: 'Scope 2 · Énergie indirecte', sublabel: 'Électricité réseau STEG',
            value: BILAN.scope2.total_tco2e, color: '#1d6fb8', bg: '#e8f3fd',
            pctColor: '#1d6fb8', pctBg: '#e8f3fd' },
          { label: 'Scope 3 · Mobilité domicile-campus', sublabel: 'Enquête déplacements',
            value: BILAN.scope3.total_tco2e, color: '#5b4fcf', bg: '#eeedfe',
            pctColor: '#5b4fcf', pctBg: '#eeedfe' },
        ].map((s, i) => (
          <div className="scope-bar-card" key={i}>
            <div className="scope-bar-top">
              <div>
                <div className="scope-bar-label" style={{fontWeight:600, color:'#2e2e2b'}}>{s.label}</div>
                <div style={{fontSize:11, color:'#888884', marginTop:2}}>{s.sublabel}</div>
              </div>
              <div className="scope-bar-pct" style={{
                background: s.pctBg, color: s.pctColor,
                border: `1px solid ${s.pctColor}30`,
              }}>
                {scopePct(s.value)}%
              </div>
            </div>
            <div className="scope-bar-value" style={{color: s.color}}>
              {s.value.toLocaleString('fr-FR')}
              <span style={{fontSize:14, fontWeight:400, color:'#888884', marginLeft:4}}>tCO₂e</span>
            </div>
            <div className="scope-bar-track">
              <div className="scope-bar-fill" style={{
                width: `${scopePct(s.value)}%`,
                background: s.color,
              }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Donut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">🎯</div>
              Répartition des émissions
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={PIE_DATA} cx="50%" cy="50%"
                  innerRadius={58} outerRadius={88}
                  dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}
                >
                  {PIE_DATA.map((d, i) => (
                    <Cell key={i} fill={d.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} tCO₂e`, '']} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text overlay effect with legend below */}
            <div style={{marginTop:8}}>
              {PIE_DATA.map(d => (
                <div key={d.name} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'7px 0',
                  borderBottom:'1px solid #f0f0ef',
                }}>
                  <span style={{
                    width:10, height:10, borderRadius:3,
                    background:d.fill, flexShrink:0,
                  }}/>
                  <span style={{flex:1, fontSize:13, color:'#636360'}}>{d.name}</span>
                  <span style={{
                    fontFamily:'DM Mono,monospace', fontSize:13,
                    fontWeight:600, color:'#2e2e2b',
                  }}>
                    {d.value.toLocaleString('fr-FR')}
                  </span>
                  <span style={{
                    fontSize:11, color:d.fill, fontWeight:700,
                    background:`${d.fill}15`, padding:'1px 6px',
                    borderRadius:99, minWidth:42, textAlign:'center',
                  }}>
                    {d.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Area chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">📈</div>
              Évolution historique des émissions
            </div>
            <span className="badge badge-neutral">{annees?.[0] || annee_debut - 4} – {annee_fin}</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={HISTO} margin={{top:4, right:4, bottom:0, left:-10}}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b93232" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#b93232" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d6fb8" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#1d6fb8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b4fcf" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#5b4fcf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f0f0ef" vertical={false}/>
                <XAxis dataKey="an" tick={{fontSize:12, fill:'#888884'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11, fill:'#888884'}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{fontSize:12, paddingTop:8}}/>
                <Area type="monotone" dataKey="s1" name="Scope 1" stroke="#b93232" fill="url(#g1)" strokeWidth={2} dot={{r:3, fill:'#b93232'}}/>
                <Area type="monotone" dataKey="s2" name="Scope 2" stroke="#1d6fb8" fill="url(#g2)" strokeWidth={2} dot={{r:3, fill:'#1d6fb8'}}/>
                <Area type="monotone" dataKey="s3" name="Scope 3" stroke="#5b4fcf" fill="url(#g3)" strokeWidth={2} dot={{r:3, fill:'#5b4fcf'}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* IA Recommendations */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header">
          <div className="card-title">
            <div className="card-icon">◆</div>
            Recommandations prioritaires — Analyse IA
          </div>
          {loading ? (
            <span className="badge badge-neutral">Chargement...</span>
          ) : (
            <span className="badge badge-green">
              {iaData?.recommandations?.length || 0} actions identifiées
            </span>
          )}
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{padding:'20px 0', textAlign:'center', color:'#888884', fontSize:13}}>
              Analyse des données en cours...
            </div>
          ) : iaData?.recommandations ? (
            <div className="grid-2" style={{gap:12}}>
              {iaData.recommandations.slice(0, 4).map((rec, i) => (
                <div className="reco-card" key={i} style={{
                  '--reco-color': ['#b93232','#1d6fb8','#336b12','#c47d18'][i % 4],
                }}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                    <div className="reco-title">#{rec.priorite} · {rec.titre}</div>
                    <span className="badge badge-neutral" style={{flexShrink:0,fontSize:11}}>
                      {rec.niveau_effort || 'modéré'}
                    </span>
                  </div>
                  <div className="reco-desc">
                    {rec.description?.slice(0, 130)}
                    {rec.description?.length > 130 ? '…' : ''}
                  </div>
                  <div className="reco-footer">
                    <div className="reco-saving">
                      −{rec.reduction_potentielle_tco2e} tCO₂e de réduction estimée
                    </div>
                    <span className="badge badge-green" style={{fontSize:11}}>↗ {rec.categorie}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{padding:'20px 0', textAlign:'center', color:'#888884', fontSize:13}}>
              Aucune recommandation disponible
            </div>
          )}
        </div>
      </div>

      {/* Scope 1 breakdown */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <div className="card-icon">🔍</div>
            Détail Scope 1 — Sources d'émissions directes
          </div>
          <span className="badge badge-red">193 tCO₂e · 15%</span>
        </div>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source d'émission</th>
                <th>Quantité</th>
                <th>Facteur</th>
                <th>Émissions</th>
                <th>Part</th>
              </tr>
            </thead>
            <tbody>
              {[
                { src: 'Combustion — Gaz naturel', qty: '15 200 m³', fac: '2,202 kg/m³', val: 135.2, pct: 70.1, color:'#b93232' },
                { src: 'Véhicules institutionnels', qty: '1 360 L (ES+DI)', fac: '2,49 kg/L moy.', val: 37.8, pct: 19.6, color:'#c47d18' },
                { src: 'Fuites frigorigènes (R-410A)', qty: '9,5 kg rechargés', fac: 'PRG = 2 088', val: 20.0, pct: 10.4, color:'#5b4fcf' },
              ].map((r, i) => (
                <tr key={i}>
                  <td style={{fontWeight:500, color:'#2e2e2b'}}>{r.src}</td>
                  <td className="mono">{r.qty}</td>
                  <td className="mono" style={{color:'#888884'}}>{r.fac}</td>
                  <td className="mono" style={{fontWeight:700, color: r.color}}>
                    {r.val.toLocaleString('fr-FR')} tCO₂e
                  </td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{
                        height:5, width:`${r.pct}%`, maxWidth:80, minWidth:20,
                        background:r.color, borderRadius:99, opacity:0.7,
                      }}/>
                      <span style={{fontSize:12, fontWeight:600, color:'#636360'}}>{r.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
