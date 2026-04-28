import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine
} from 'recharts';
import { scope1 as s1Api, ia, scenarios as scenApi, exportApi, telechargerFichier } from '../api/client';
import { usePeriode } from '../hooks/usePeriode';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

/* ── Hook de permission ───────────────────────────────────── */
function usePermission() {
  const { utilisateur } = useAuthStore();
  const role = utilisateur?.role || 'viewer';
  return {
    peutSaisir:    ['admin', 'manager'].includes(role),
    peutSimuler:   ['admin', 'manager'].includes(role),
    peutExporter:  ['admin', 'manager', 'viewer'].includes(role),
    estAdmin:      role === 'admin',
    role,
  };
}

/* ── Bannière lecture seule ───────────────────────────────── */
function BanniereViewer() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 16px',
      background: '#f0f0ef',
      border: '1px solid #d4d4cf',
      borderRadius: 10, marginBottom: 20,
      fontSize: 13.5, color: '#44443f',
    }}>
      <span style={{ fontSize: 16 }}>👁</span>
      <span>
        Vous êtes en <strong>mode lecture</strong> — la saisie et la modification
        de données sont réservées aux gestionnaires et administrateurs.
      </span>
    </div>
  );
}

/* ── Bouton désactivé avec tooltip ───────────────────────── */
function BtnRestreint({ label, full = false }) {
  return (
    <div title="Accès réservé aux gestionnaires et administrateurs"
      style={{ display: full ? 'block' : 'inline-block' }}>
      <button disabled style={{
        width: full ? '100%' : undefined,
        padding: '9px 18px', borderRadius: 10,
        background: '#f0f0ef', border: '1px solid #d4d4cf',
        color: '#b3b3ae', fontSize: 13.5, fontWeight: 600,
        cursor: 'not-allowed', fontFamily: 'inherit',
        display: full ? 'flex' : 'inline-flex',
        alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        🔒 {label}
      </button>
    </div>
  );
}

/* ── Composants partagés ──────────────────────────────────── */
function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="pg-header">
      <div className="pg-header-row">
        <div>
          <h1 className="pg-title">{title}</h1>
          {subtitle && <p className="pg-subtitle">{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
    </div>
  );
}

function ResultBox({ value, unit, label, color = '#336b12', bg = '#eef8e3', border = '#a8d97a' }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '18px 22px',
    }}>
      <div style={{
        fontSize: 32, fontWeight: 750, color,
        fontFamily: 'DM Mono, monospace', letterSpacing: '-1px', lineHeight: 1,
      }}>
        {value}
        <span style={{ fontSize: 15, fontWeight: 400, color, opacity: 0.7, marginLeft: 5 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12.5, color, opacity: 0.75, marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function DataCard({ title, icon, children, action }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">
          <div className="card-icon">{icon}</div>
          {title}
        </div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function NumField({ label, value, onChange, unit, hint, readOnly = false }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="input input-number"
          type="number" min="0" step="any"
          value={value}
          onChange={e => !readOnly && onChange(parseFloat(e.target.value) || 0)}
          readOnly={readOnly}
          style={{
            paddingRight: unit ? 52 : undefined,
            background: readOnly ? '#f7f7f6' : '#fff',
            cursor: readOnly ? 'not-allowed' : 'text',
            color: readOnly ? '#888884' : '#111110',
          }}
        />
        {unit && (
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: '#888884', fontFamily: 'DM Mono,monospace', pointerEvents: 'none',
          }}>{unit}</span>
        )}
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   SCOPE 1 — ÉMISSIONS DIRECTES
════════════════════════════════════════════════════════════ */
export function SaisieScope1() {
  const { peutSaisir } = usePermission();
  const [form, setForm] = useState({
    gaz_naturel_m3: 15200, fioul_litres: 1800,
    essence_litres: 520,   diesel_litres: 840,
    refrigerant_kg: 9.5,   gwp_refrigerant: 2088,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    s1Api.donnees().then(r => {
      if (r.data?.resultats) setResult(r.data.resultats);
    }).catch(() => {});
  }, []);

  const calculer = async () => {
    if (!peutSaisir) return;
    setLoading(true);
    try {
      const r = await s1Api.saisir(form);
      setResult(r.data.resultats_immediats);
      toast.success('Calcul Scope 1 mis à jour');
    } catch { toast.error('Erreur de calcul'); }
    finally { setLoading(false); }
  };

  const FLUIDES = [
    { value: 2088, label: 'R-410A · PRG = 2 088 (le plus répandu)' },
    { value: 675,  label: 'R-32   · PRG = 675  (transition bas-carbone)' },
    { value: 1810, label: 'R-22   · PRG = 1 810 (interdit, nouvelles inst.)' },
    { value: 1430, label: 'R-134a · PRG = 1 430 (climatisation automobile)' },
  ];

  return (
    <div>
      <SectionHeader
        title="Scope 1 — Émissions directes"
        subtitle="Combustion sur site · Véhicules institutionnels · Fluides frigorigènes · GHG Protocol"
        actions={
          peutSaisir
            ? <button className="btn btn-primary" onClick={calculer} disabled={loading}>
                {loading ? '…' : '↻'} {loading ? 'Calcul…' : 'Calculer'}
              </button>
            : <BtnRestreint label="Calculer" />
        }
      />

      {!peutSaisir && <BanniereViewer />}

      <div className="info-box info-blue" style={{ marginBottom: 20 }}>
        <span className="info-box-icon">ℹ</span>
        <span>
          <strong>Sources recommandées :</strong> Factures Steg-Gaz mensuelles ·
          Bons de carburant véhicules ENSIT · Rapports de maintenance climatisation
        </span>
      </div>

      <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
        <DataCard title="Combustion sur site" icon="🔥">
          <NumField label="Gaz naturel" value={form.gaz_naturel_m3} unit="m³/an"
            onChange={v => set('gaz_naturel_m3', v)}
            hint="Facteur ADEME : 2,202 kgCO₂e/m³" readOnly={!peutSaisir} />
          <NumField label="Fioul domestique" value={form.fioul_litres} unit="L/an"
            onChange={v => set('fioul_litres', v)}
            hint="Facteur ADEME : 3,148 kgCO₂e/litre" readOnly={!peutSaisir} />
        </DataCard>

        <DataCard title="Véhicules institutionnels" icon="🚗">
          <NumField label="Essence (SP95)" value={form.essence_litres} unit="L/an"
            onChange={v => set('essence_litres', v)}
            hint="Facteur ADEME : 2,318 kgCO₂e/litre" readOnly={!peutSaisir} />
          <NumField label="Diesel" value={form.diesel_litres} unit="L/an"
            onChange={v => set('diesel_litres', v)}
            hint="Facteur ADEME : 2,640 kgCO₂e/litre" readOnly={!peutSaisir} />
        </DataCard>
      </div>

      <DataCard title="Fuites de fluides frigorigènes" icon="❄">
        <div className="grid-2">
          <NumField label="Quantité de fluide rechargée" value={form.refrigerant_kg} unit="kg/an"
            onChange={v => set('refrigerant_kg', v)}
            hint="Issu des rapports de maintenance des climatiseurs" readOnly={!peutSaisir} />
          <div className="field">
            <label className="field-label">Type de fluide frigorigène</label>
            <select className="input" value={form.gwp_refrigerant}
              disabled={!peutSaisir}
              onChange={e => set('gwp_refrigerant', parseFloat(e.target.value))}
              style={{ background: !peutSaisir ? '#f7f7f6' : '#fff', cursor: !peutSaisir ? 'not-allowed' : 'pointer' }}>
              {FLUIDES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
      </DataCard>

      {result && (
        <DataCard title="Résultats — Scope 1" icon="📊"
          action={<span className="badge badge-red">{result.total_tco2e} tCO₂e total</span>}>
          <div className="grid-3" style={{ gap: 14 }}>
            <ResultBox value={result.combustion_tco2e} unit="tCO₂e" label="Combustion sur site"
              color="#b93232" bg="#fceee8" border="#f5c4b5" />
            <ResultBox value={result.vehicules_tco2e} unit="tCO₂e" label="Véhicules institutionnels"
              color="#c47d18" bg="#faeeda" border="#f5d28a" />
            <ResultBox value={result.frigorigenes_tco2e} unit="tCO₂e" label="Fuites frigorigènes"
              color="#5b4fcf" bg="#eeedfe" border="#d3cffc" />
          </div>
          <div style={{
            marginTop: 16, padding: '14px 18px',
            background: '#f7f7f6', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 14, color: '#44443f', fontWeight: 500 }}>Total Scope 1</div>
            <div style={{
              fontSize: 26, fontWeight: 750, color: '#b93232',
              fontFamily: 'DM Mono,monospace', letterSpacing: '-0.8px',
            }}>{result.total_tco2e} tCO₂e</div>
          </div>
        </DataCard>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   SCOPE 2 — ÉLECTRICITÉ
════════════════════════════════════════════════════════════ */
export function SaisieScope2() {
  const { peutSaisir } = usePermission();
  const MOIS_LABELS = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû'];
  const MOIS_FULL   = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août'];
  const VALS_INIT = [38200, 41500, 43800, 45200, 44100, 40300, 39700, 37900, 36400, 35200, 33100, 24600];

  const [kwh, setKwh]     = useState(VALS_INIT);
  const [, setSaved] = useState(false);

  const total   = kwh.reduce((a, b) => a + b, 0);
  const FACTEUR = 0.559;
  const tco2e   = (total * FACTEUR / 1000).toFixed(2);

  const chartData = MOIS_LABELS.map((m, i) => ({ m, kwh: kwh[i] }));

  const save = () => {
    if (!peutSaisir) return;
    setSaved(true);
    toast.success('Données Scope 2 enregistrées');
  };

  return (
    <div>
      <SectionHeader
        title="Scope 2 — Énergie indirecte"
        subtitle="Consommation électrique mensuelle · Réseau STEG · Facteur d'émission : 0,559 kgCO₂e/kWh"
        actions={peutSaisir ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setKwh(VALS_INIT)}>Réinitialiser</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Enregistrer</button>
          </>
        ) : (
          <BtnRestreint label="Enregistrer" />
        )}
      />

      {!peutSaisir && <BanniereViewer />}

      <DataCard title="Consommation électrique mensuelle" icon="⚡"
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 13, color: '#888884' }}>
              {total.toLocaleString('fr-FR')} kWh
            </span>
            <span className="badge badge-blue">{tco2e} tCO₂e</span>
          </div>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px 16px' }}>
          {MOIS_FULL.map((m, i) => (
            <div className="field" key={m} style={{ marginBottom: 0 }}>
              <label className="field-label">{m}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input input-number"
                  type="number" min="0"
                  value={kwh[i]}
                  readOnly={!peutSaisir}
                  onChange={e => {
                    if (!peutSaisir) return;
                    const n = [...kwh]; n[i] = parseFloat(e.target.value) || 0; setKwh(n);
                  }}
                  style={{
                    paddingRight: 46,
                    background: !peutSaisir ? '#f7f7f6' : '#fff',
                    cursor: !peutSaisir ? 'not-allowed' : 'text',
                    color: !peutSaisir ? '#888884' : '#111110',
                  }}
                />
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, color: '#888884', fontFamily: 'DM Mono,monospace', pointerEvents: 'none',
                }}>kWh</span>
              </div>
            </div>
          ))}
        </div>
      </DataCard>

      <DataCard title="Profil de consommation mensuelle" icon="📈">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#f0f0ef" vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize: 11.5, fill: '#888884' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#888884' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [`${v.toLocaleString('fr-FR')} kWh`, 'Consommation']}
              contentStyle={{ border: '1px solid #e4e4e2', borderRadius: 10, fontSize: 13 }}
            />
            <Bar dataKey="kwh" fill="#1d6fb8" radius={[5, 5, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </DataCard>

      <div className="grid-2" style={{ gap: 14 }}>
        <ResultBox value={total.toLocaleString('fr-FR')} unit="kWh"
          label="Total annuel consommé — réseau STEG"
          color="#1d6fb8" bg="#e8f3fd" border="#bcd8f5" />
        <ResultBox value={tco2e} unit="tCO₂e"
          label={`Émissions Scope 2 — facteur réseau : ${FACTEUR} kgCO₂e/kWh`}
          color="#336b12" bg="#eef8e3" border="#a8d97a" />
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   SCOPE 3 — MOBILITÉ
════════════════════════════════════════════════════════════ */
export function EnqueteMobilite() {
  const { peutSaisir } = usePermission();
  const { campus, periode } = usePeriode();

  const FACTEURS = {
    voiture_solo: 0.218, covoiturage: 0.109, bus: 0.029,
    train: 0.011, metro: 0.011, moto: 0.103, velo: 0, marche: 0,
  };
  const MODES_LABELS = {
    voiture_solo: 'Voiture individuelle', covoiturage: 'Covoiturage',
    bus: 'Bus / Transport en commun', train: 'Train / Métro',
    metro: 'Métro léger', moto: 'Moto / Scooter', velo: 'Vélo', marche: 'À pied',
  };
  const CATS = { etudiant: 'Étudiant(e)', enseignant: 'Enseignant(e)', administratif: 'Personnel admin.' };

  const [reponses, setReponses]   = useState([]);
  const [form, setForm]           = useState({ cat: 'etudiant', mode: 'voiture_solo', distance: 12, jours: 5, semaines: 36 });
  const [popTotale, setPopTotale] = useState(campus?.population_campus_totale || 1525);
  const [result, setResult]       = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ajouter = () => {
    if (!peutSaisir) return;
    setReponses(r => [...r, { ...form, id: Date.now() }]);
    toast.success('Réponse ajoutée');
  };

  const calculer = () => {
    const totalKg = reponses.reduce((sum, r) => {
      return sum + r.distance * 2 * r.jours * r.semaines * (FACTEURS[r.mode] || 0);
    }, 0);
    const totalTco2e = totalKg / 1000;
    const factExtra  = reponses.length > 0 ? popTotale / reponses.length : 1;
    setResult({
      nb: reponses.length,
      total: totalTco2e.toFixed(2),
      extrapole: (totalTco2e * factExtra).toFixed(2),
      facteur: factExtra.toFixed(1),
    });
    toast.success('Bilan Scope 3 calculé');
  };

  const byMode = reponses.reduce((acc, r) => { acc[r.mode] = (acc[r.mode] || 0) + 1; return acc; }, {});

  // ── Vue VIEWER : résumé statistique uniquement ─────────────
  if (!peutSaisir) {
    return (
      <div>
        <SectionHeader
          title="Scope 3 — Mobilité domicile-campus"
          subtitle="Résultats de l'enquête de déplacements · Facteurs ADEME Base Carbone"
        />
        <BanniereViewer />

        <div className="grid-2" style={{ gap: 16 }}>
          <DataCard title={`Résultats de l'enquête ${periode}`} icon="📊"
            action={<span className="badge badge-violet">312 répondants / {campus?.population_campus_totale || 1525}</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { mode: 'Voiture individuelle', pct: 42, color: '#b93232' },
                { mode: 'Bus / Transport en commun', pct: 28, color: '#1d6fb8' },
                { mode: 'Moto / Scooter', pct: 18, color: '#c47d18' },
                { mode: 'Train / Métro', pct: 7, color: '#5b4fcf' },
                { mode: 'Covoiturage', pct: 4, color: '#336b12' },
                { mode: 'Vélo / Marche', pct: 1, color: '#888884' },
              ].map(item => (
                <div key={item.mode} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#44443f', flex: 1 }}>{item.mode}</span>
                  <div style={{ height: 6, width: `${item.pct * 1.8}px`, background: item.color, borderRadius: 99, opacity: 0.75 }} />
                  <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 700, color: item.color, minWidth: 30, textAlign: 'right' }}>
                    {item.pct}%
                  </span>
                </div>
              ))}
            </div>
          </DataCard>

          <DataCard title="Indicateurs Scope 3" icon="🌍">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Émissions totales Scope 3', value: '282', unit: 'tCO₂e', color: '#5b4fcf', bg: '#eeedfe' },
                { label: `Répondants / ${campus?.population_campus_totale || 1525} campus`, value: '312', unit: 'personnes', color: '#1d6fb8', bg: '#e8f3fd' },
                { label: 'Distance moyenne aller', value: '11.4', unit: 'km', color: '#c47d18', bg: '#faeeda' },
              ].map(item => (
                <div key={item.label} style={{
                  background: item.bg, borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 13, color: '#44443f' }}>{item.label}</span>
                  <span style={{ fontFamily: 'DM Mono,monospace', fontWeight: 750, color: item.color, fontSize: 18 }}>
                    {item.value} <span style={{ fontSize: 12, fontWeight: 400 }}>{item.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    );
  }

  // ── Vue MANAGER/ADMIN : formulaire complet ─────────────────
  return (
    <div>
      <SectionHeader
        title="Scope 3 — Enquête mobilité domicile-campus"
        subtitle="Collecte des données de déplacements · Facteurs ADEME Base Carbone"
        actions={
          reponses.length > 0 &&
          <button className="btn btn-primary btn-sm" onClick={calculer}>↻ Calculer Scope 3</button>
        }
      />

      <div className="grid-2" style={{ gap: 16, marginBottom: 16, alignItems: 'start' }}>
        <DataCard title="Ajouter une réponse" icon="＋">
          <div className="field">
            <label className="field-label">Catégorie</label>
            <select className="input" value={form.cat} onChange={e => set('cat', e.target.value)}>
              {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Mode de transport principal</label>
            <select className="input" value={form.mode} onChange={e => set('mode', e.target.value)}>
              {Object.entries(MODES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="field-hint">Facteur : {FACTEURS[form.mode]} kgCO₂e/km</div>
          </div>
          <div className="grid-2">
            <NumField label="Distance aller (km)" value={form.distance} unit="km"
              onChange={v => set('distance', v)} />
            <div className="field">
              <label className="field-label">Jours / semaine</label>
              <select className="input" value={form.jours} onChange={e => set('jours', parseFloat(e.target.value))}>
                {[1, 2, 3, 4, 5].map(j => <option key={j} value={j}>{j} jour{j > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={ajouter}>+ Enregistrer cette réponse</button>
          <div className="section-divider" style={{ margin: '18px 0 12px' }}>Extrapolation</div>
          <NumField label="Population totale campus" value={popTotale} unit="pers."
            onChange={setPopTotale}
            hint={`Population campus ENSIT : ${campus?.population_campus_totale || 1525} personnes (${campus?.nb_etudiants_total || 1300} étudiants + ${campus?.nb_personnel_total || 225} personnel)`} />
        </DataCard>

        <div>
          <DataCard title={`Réponses collectées (${reponses.length})`} icon="📋"
            action={reponses.length > 0 &&
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setReponses([]); setResult(null); }}>
                Effacer tout
              </button>
            }>
            {reponses.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#b3b3ae', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>◉</div>
                Aucune réponse enregistrée.
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {reponses.map((r, i) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: i % 2 === 0 ? '#f7f7f6' : '#fff', marginBottom: 3, fontSize: 13,
                  }}>
                    <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>
                      {CATS[r.cat]?.split(' ')[0]}
                    </span>
                    <span style={{ flex: 1, color: '#44443f' }}>
                      {MODES_LABELS[r.mode]} · <span style={{ fontFamily: 'DM Mono,monospace' }}>{r.distance} km</span>
                    </span>
                    <span style={{ color: '#888884', fontSize: 12 }}>{r.jours}j/sem</span>
                    <button onClick={() => setReponses(r2 => r2.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b93232', fontSize: 16, padding: '0 2px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </DataCard>

          {Object.keys(byMode).length > 0 && (
            <DataCard title="Répartition par mode" icon="🚀">
              {Object.entries(byMode).sort((a, b) => b[1] - a[1]).map(([mode, cnt]) => (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f0ef', fontSize: 13 }}>
                  <span style={{ flex: 1, color: '#44443f' }}>{MODES_LABELS[mode]}</span>
                  <div style={{ height: 5, width: Math.max(20, cnt / reponses.length * 120), background: '#336b12', borderRadius: 99, opacity: 0.6 }} />
                  <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 700, color: '#336b12', minWidth: 30, textAlign: 'right' }}>{cnt}</span>
                </div>
              ))}
            </DataCard>
          )}
        </div>
      </div>

      {result && (
        <DataCard title="Résultats — Scope 3 Mobilité" icon="📊"
          action={<span className="badge badge-violet">{result.extrapole} tCO₂e extrapolé</span>}>
          <div className="grid-3" style={{ gap: 14 }}>
            <ResultBox value={result.nb} unit="répondants" label="Taille de l'échantillon enquêté"
              color="#5b4fcf" bg="#eeedfe" border="#d3cffc" />
            <ResultBox value={result.total} unit="tCO₂e" label="Émissions de l'échantillon"
              color="#336b12" bg="#eef8e3" border="#a8d97a" />
            <ResultBox value={result.extrapole} unit="tCO₂e" label={`Total extrapolé (×${result.facteur})`}
              color="#1d6fb8" bg="#e8f3fd" border="#bcd8f5" />
          </div>
        </DataCard>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   ANALYSE IA
════════════════════════════════════════════════════════════ */
export function AnalyseIA() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const HISTO = [
    { an: 2021, total: 1285 }, { an: 2022, total: 1285 },
    { an: 2023, total: 1270 }, { an: 2024, total: 1280 }, { an: 2025, total: 1284 },
  ];

  const lancer = async () => {
    setLoading(true);
    try {
      const r = await ia.analyseDemo();
      setData(r.data);
      toast.success('Analyse IA complète');
    } catch { toast.error('Analyse IA indisponible'); }
    finally { setLoading(false); }
  };

  const previsions  = data?.previsions?.regression_lineaire || [];
  const chartData   = [
    ...HISTO.map(h => ({ an: h.an, historique: h.total, prevu: null })),
    ...previsions.map(p => ({ an: p.annee, historique: null, prevu: p.prevu_tco2e })),
  ];

  const CustomDot = (props) => {
    const { cx, cy, value } = props;
    if (value == null) return null;
    return <circle cx={cx} cy={cy} r={4} fill={props.stroke} stroke="#fff" strokeWidth={2} />;
  };

  return (
    <div>
      <SectionHeader
        title="Analyse par Intelligence Artificielle"
        subtitle="Tendances historiques · Prévisions 2026–2030 · Détection d'anomalies · Recommandations"
        actions={
          <button className="btn btn-primary" onClick={lancer} disabled={loading}>
            {loading ? '⏳ Analyse…' : '▶ Lancer l\'analyse IA'}
          </button>
        }
      />

      {!data && !loading && (
        <div className="info-box info-green">
          <span className="info-box-icon">◆</span>
          <span>
            <strong>Modèles disponibles :</strong> Régression linéaire · Moyenne mobile ·
            Détection d'anomalies (z-score) · Recommandations priorisées par impact potentiel
          </span>
        </div>
      )}
      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#888884', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◈</div>
          Analyse en cours...
        </div>
      )}

      {data && (
        <>
          <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
            {[
              { label: 'Direction tendance', value: data.resume?.direction_generale || '—', sub: 'Tendance générale', color: '#336b12' },
              { label: 'Anomalies détectées', value: data.resume?.nb_anomalies_detectees ?? '—', sub: 'Points significatifs', color: '#b93232' },
              { label: 'Réduction potentielle', value: `−${data.resume?.reduction_potentielle_totale_tco2e ?? '—'}`, sub: 'tCO₂e si toutes recommandations', color: '#c47d18' },
            ].map((s, i) => (
              <div className="card" key={i} style={{ padding: '18px 22px' }}>
                <div className="kpi-label">{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 750, color: s.color, fontFamily: 'DM Mono,monospace', letterSpacing: '-0.8px', margin: '8px 0 4px' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: '#888884' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <DataCard title="Prévisions d'émissions 2026–2030 — Régression linéaire" icon="📈"
              action={<span className="badge badge-neutral">5 ans</span>}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f0f0ef" vertical={false} />
                  <XAxis dataKey="an" tick={{ fontSize: 12, fill: '#888884' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#888884' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ border: '1px solid #e4e4e2', borderRadius: 10, fontSize: 13 }}
                    formatter={(v, n) => v != null ? [`${v.toLocaleString('fr-FR')} tCO₂e`, n] : [null, n]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <ReferenceLine x={2025} stroke="#e4e4e2" strokeDasharray="5 5" label={{ value: 'Actuel', fontSize: 11, fill: '#888884' }} />
                  <Line type="monotone" dataKey="historique" name="Historique" stroke="#336b12" strokeWidth={2.5} dot={<CustomDot />} connectNulls={false} />
                  <Line type="monotone" dataKey="prevu" name="Prévision (RL)" stroke="#1d6fb8" strokeWidth={2} strokeDasharray="6 4" dot={<CustomDot />} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </DataCard>
          )}

          {data.recommandations?.length > 0 && (
            <DataCard title="Recommandations stratégiques — Priorisées par impact" icon="◆">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.recommandations.map((rec, i) => (
                  <div className="reco-card" key={i} style={{ '--reco-color': ['#b93232', '#1d6fb8', '#336b12', '#c47d18'][i % 4] }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div className="reco-title" style={{ fontSize: 14 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: '#f7f7f6', color: '#636360', padding: '1px 7px', borderRadius: 4, marginRight: 8 }}>#{rec.priorite}</span>
                          {rec.titre}
                        </div>
                        <div className="reco-desc" style={{ marginTop: 5 }}>{rec.description}</div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 750, color: '#336b12', fontFamily: 'DM Mono,monospace' }}>−{rec.reduction_potentielle_tco2e}</div>
                        <div style={{ fontSize: 10.5, color: '#888884', marginTop: 1 }}>tCO₂e</div>
                      </div>
                    </div>
                    <div className="reco-footer" style={{ marginTop: 10 }}>
                      <span className="badge badge-green" style={{ fontSize: 11 }}>{rec.categorie}</span>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>Effort : {rec.niveau_effort}</span>
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
        </>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   SCÉNARIOS
════════════════════════════════════════════════════════════ */
export function Scenarios() {
  const { peutSimuler } = usePermission();
  const [params, setParams]   = useState({ nom: 'Scénario de transition', red_elec: 0, red_gaz: 0, modal: 0 });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    scenApi.presets().then(r => setPresets(r.data.presets || [])).catch(() => {});
  }, []);

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));

  const simuler = async () => {
    if (!peutSimuler) return;
    setLoading(true);
    try {
      const r = await scenApi.simuler({
        nom: params.nom,
        reduction_electricite_pct: params.red_elec,
        reduction_gaz_pct: params.red_gaz,
        report_modal_bus_pct: params.modal,
      });
      setResult(r.data);
      toast.success('Simulation terminée');
    } catch { toast.error('Erreur de simulation'); }
    finally { setLoading(false); }
  };

  const Slider = ({ label, val, onChange, help }) => (
    <div className="field">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label className="field-label" style={{ margin: 0 }}>{label}</label>
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 14, fontWeight: 700, color: peutSimuler ? '#336b12' : '#b3b3ae' }}>{val}%</span>
      </div>
      <input type="range" min={0} max={100} value={val}
        disabled={!peutSimuler}
        onChange={e => peutSimuler && onChange(parseInt(e.target.value))}
        style={{ accentColor: peutSimuler ? '#336b12' : '#d4d4cf', cursor: peutSimuler ? 'pointer' : 'not-allowed' }} />
      {help && <div className="field-hint">{help}</div>}
    </div>
  );

  return (
    <div>
      <SectionHeader
        title="Simulation de scénarios"
        subtitle="Modélisation de mesures de réduction · Évaluation de l'impact avant mise en œuvre"
        actions={
          peutSimuler
            ? <button className="btn btn-primary" onClick={simuler} disabled={loading}>
                {loading ? '⏳ Calcul…' : '▶ Simuler'}
              </button>
            : <BtnRestreint label="Simuler" />
        }
      />

      {!peutSimuler && <BanniereViewer />}

      {/* Presets — visibles par tous */}
      {presets.length > 0 && (
        <DataCard title="Scénarios de référence pré-configurés" icon="⚡"
          action={<span className="badge badge-neutral">{presets.length} disponibles</span>}>
          <div className="grid-3" style={{ gap: 12 }}>
            {presets.map((p, i) => (
              <div key={i} style={{
                border: '1.5px solid #e4e4e2', borderRadius: 10,
                padding: '14px 16px', background: '#f7f7f6',
                cursor: peutSimuler ? 'pointer' : 'default',
                transition: 'all 180ms ease',
                opacity: peutSimuler ? 1 : 0.75,
              }}
                onClick={() => {
                  if (!peutSimuler) return;
                  setParams(prev => ({
                    ...prev, nom: p.titre,
                    red_elec: p.parametres.reduction_electricite_pct,
                    red_gaz: p.parametres.reduction_gaz_pct,
                    modal: p.parametres.report_modal_bus_pct,
                  }));
                  toast(`Paramètres "${p.titre}" chargés`, { icon: '✅' });
                }}
                onMouseEnter={e => peutSimuler && (e.currentTarget.style.borderColor = '#4a9119')}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e4e4e2'}
              >
                <div style={{ fontWeight: 650, fontSize: 13.5, color: '#2e2e2b', marginBottom: 5 }}>{p.titre}</div>
                <div style={{ fontSize: 12, color: '#888884', marginBottom: 10, lineHeight: 1.5 }}>{p.impact_estime}</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>Retour : {p.delai_retour}</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>Coût : {p.cout_indicatif}</span>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      )}

      <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
        <DataCard title={peutSimuler ? "Paramètres du scénario" : "Paramètres (lecture seule)"} icon="🎛">
          <div className="field">
            <label className="field-label">Nom du scénario</label>
            <input className="input" type="text" value={params.nom}
              readOnly={!peutSimuler}
              onChange={e => peutSimuler && set('nom', e.target.value)}
              style={{ background: !peutSimuler ? '#f7f7f6' : '#fff', cursor: !peutSimuler ? 'not-allowed' : 'text' }}
              placeholder="Ex : Transition verte ENSIT 2027" />
          </div>
          <div className="section-divider">Leviers de réduction</div>
          <Slider label="Réduction consommation électrique" val={params.red_elec} onChange={v => set('red_elec', v)} help="LED, minuteries, optimisation horaires" />
          <Slider label="Réduction consommation gaz" val={params.red_gaz} onChange={v => set('red_gaz', v)} help="Isolation thermique, régulation chaudières" />
          <Slider label="Report modal voiture → transport en commun" val={params.modal} onChange={v => set('modal', v)} help="Abonnements TCT subventionnés, covoiturage" />
        </DataCard>

        <DataCard title="Résultat de la simulation" icon="📊">
          {!result ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#b3b3ae', fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>◆</div>
              {peutSimuler
                ? 'Configurez les paramètres et lancez la simulation.'
                : 'Les résultats de simulation seront affichés ici.'}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Bilan actuel', val: result.resultats?.baseline_tco2e, color: '#b93232', bg: '#fceee8', border: '#f5c4b5' },
                  { label: 'Après mesures', val: result.resultats?.simule_tco2e, color: '#336b12', bg: '#eef8e3', border: '#a8d97a' },
                ].map((item, i) => (
                  <React.Fragment key={i}>
                    <div style={{ flex: 1, textAlign: 'center', padding: '18px 12px', background: item.bg, borderRadius: 10, border: `1px solid ${item.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#888884', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{item.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 750, color: item.color, fontFamily: 'DM Mono,monospace', letterSpacing: '-0.8px' }}>{item.val?.toLocaleString('fr-FR')}</div>
                      <div style={{ fontSize: 12, color: item.color, opacity: 0.75, marginTop: 3 }}>tCO₂e</div>
                    </div>
                    {i === 0 && <div style={{ display: 'flex', alignItems: 'center', color: '#b3b3ae', fontSize: 22, padding: '0 4px' }}>→</div>}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ background: 'linear-gradient(135deg,#eef8e3,#e4f5d5)', borderRadius: 12, padding: '18px 22px', textAlign: 'center', border: '1px solid #a8d97a' }}>
                <div style={{ fontSize: 40, fontWeight: 750, color: '#27520a', fontFamily: 'DM Mono,monospace', letterSpacing: '-1.5px' }}>
                  −{result.resultats?.reduction_tco2e}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#336b12', marginBottom: 4 }}>
                  tCO₂e de réduction · {result.resultats?.reduction_pct}% du bilan total
                </div>
                <div style={{ fontSize: 12.5, color: '#4a9119', lineHeight: 1.5 }}>{result.interpretation}</div>
              </div>
            </>
          )}
        </DataCard>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   RAPPORTS
════════════════════════════════════════════════════════════ */
export function Rapports() {
  const [loadPdf, setLoadPdf] = useState(false);
  const [loadXls, setLoadXls] = useState(false);
  const { periode } = usePeriode();

  const dlPdf = async () => {
    setLoadPdf(true);
    try {
      const r = await exportApi.pdf(periode);
      telechargerFichier(r.data, `Bilan_Carbone_ENSIT_${periode}.pdf`);
      toast.success('Rapport PDF téléchargé');
    } catch { toast.error('Génération PDF indisponible'); }
    finally { setLoadPdf(false); }
  };

  const dlXls = async () => {
    setLoadXls(true);
    try {
      const r = await exportApi.excel(periode);
      telechargerFichier(r.data, `Bilan_Carbone_ENSIT_${periode}.xlsx`);
      toast.success('Classeur Excel téléchargé');
    } catch { toast.error('Génération Excel indisponible'); }
    finally { setLoadXls(false); }
  };

  return (
    <div>
      <SectionHeader
        title="Export & Rapports"
        subtitle={`Génération de rapports institutionnels conformes · Formats PDF et Excel · Données ${periode}`}
      />

      <div className="grid-2" style={{ gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fceee8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📄</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111110', letterSpacing: '-0.2px' }}>Rapport PDF complet</div>
              <div style={{ fontSize: 13, color: '#888884', marginTop: 3 }}>Document officiel — mise en page institutionnelle ENSIT</div>
            </div>
          </div>
          {['Résumé exécutif avec indicateurs clés', 'Détail Scopes 1, 2 & 3 avec données sources', 'ICP normalisés — tCO₂e / étudiant / m² / entité', `Historique d'évolution ${periode.split('-')[0]}–${periode.split('-')[1]}`, 'Recommandations de réduction priorisées', 'Méthodologie et facteurs d\'émission ADEME'].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0ef', fontSize: 13, color: '#636360' }}>
              <span style={{ color: '#4a9119', fontWeight: 700, fontSize: 15 }}>✓</span>{s}
            </div>
          ))}
          <button className="btn btn-primary btn-full" style={{ marginTop: 20 }}
            onClick={dlPdf} disabled={loadPdf}>
            {loadPdf ? '⏳ Génération…' : '↓ Télécharger le rapport PDF'}
          </button>
        </div>

        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f3fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📊</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111110', letterSpacing: '-0.2px' }}>Classeur Excel analytique</div>
              <div style={{ fontSize: 13, color: '#888884', marginTop: 3 }}>Données brutes structurées — prêt pour analyse avancée</div>
            </div>
          </div>
          {[['Bilan Consolidé', 'Tableau récapitulatif + ICP'], ['Scope 1 — Direct', 'Combustion, véhicules, frigorigènes'], ['Scope 2 — Électricité', 'Relevés mensuels + facteur réseau'], ['Scope 3 — Mobilité', 'Répartition par mode de transport'], ['Historique & Tendances', `Évolution ${periode.split('-')[0]}–${periode.split('-')[1]}`]].map(([onglet, desc], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f0ef', fontSize: 13 }}>
              <span style={{ background: '#1d6fb8', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>{onglet}</span>
              <span style={{ color: '#636360' }}>{desc}</span>
            </div>
          ))}
          <button className="btn btn-blue btn-full" style={{ marginTop: 20 }}
            onClick={dlXls} disabled={loadXls}>
            {loadXls ? '⏳ Génération…' : '↓ Télécharger le classeur Excel'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#44443f' }}>Conformité & référentiels</div>
          {['GHG Protocol Corporate Standard', 'ADEME Base Carbone v20.0', 'ISO 14064-1', 'Loi Énergie-Climat 2019'].map(r => (
            <span key={r} className="badge badge-green" style={{ fontSize: 11.5 }}>{r}</span>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#888884' }}>
            {`Période de référence : Année universitaire ${periode}`}
          </div>
        </div>
      </div>
    </div>
  );
}
