import React, { useState, useCallback } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell
} from 'recharts';

/* ═══════════════════════════════════════════════════════════
   DONNÉES DE RÉFÉRENCE — Facteurs ADEME Base Carbone
═══════════════════════════════════════════════════════════ */
const FE = {
  // Transport (kgCO2e/km)
  voiture_essence: 0.218, voiture_diesel: 0.195,
  voiture_electrique: 0.047, moto: 0.103,
  bus: 0.029, train: 0.011, avion_court: 0.258,
  velo: 0, marche: 0,

  // Alimentation (kgCO2e/kg ou portion)
  boeuf: 27.0, agneau: 23.8, porc: 5.8,
  poulet: 4.5, poisson: 2.7,
  oeuf: 4.5, fromage: 9.8,
  lait: 1.55, legumes: 0.5, fruits: 0.5,

  // Logement (kgCO2e/kWh)
  electricite: 0.559, gaz: 0.227, fioul: 3.148,

  // Numérique (kgCO2e/an)
  smartphone_fab: 70, smartphone_usage: 8,
  laptop_fab: 156, laptop_usage: 23,
  streaming_h: 0.036,
};

/* Moyennes nationales tunisiennes pour comparaison */
const MOYENNE_TN = 2.8; // tCO2e/an/personne
const OBJECTIF_PARIS = 2.0; // tCO2e/an/pers pour rester < 2°C

/* ═══════════════════════════════════════════════════════════
   ÉTAT INITIAL
═══════════════════════════════════════════════════════════ */
const INITIAL = {
  // Transport
  km_voiture_semaine: 80, type_voiture: 'voiture_essence',
  km_bus_semaine: 0, km_train_an: 0,
  km_avion_an: 0, teletravail_jours: 0,

  // Alimentation
  repas_boeuf_semaine: 2, repas_poulet_semaine: 3,
  repas_poisson_semaine: 2, repas_vege_semaine: 7,
  consommation_laitiers: 'moyen',

  // Logement
  surface_m2: 60, nb_personnes_foyer: 3,
  type_chauffage: 'electricite', kwh_elec_mois: 200,

  // Numérique
  nb_smartphones: 1, nb_laptops: 1,
  heures_streaming_jour: 2,
};

/* ═══════════════════════════════════════════════════════════
   CALCULS
═══════════════════════════════════════════════════════════ */
function calculerEmpreinte(d) {
  // ── Transport ──────────────────────────────────────────
  const semaines_an = 47; // 47 semaines × 5 jours travaillés
  const jours_present = 5 - Math.min(d.teletravail_jours, 5);
  const ratio_presence = jours_present / 5;

  const co2_voiture = d.km_voiture_semaine * ratio_presence
    * semaines_an * 2 * (FE[d.type_voiture] || 0.218) / 1000;
  const co2_bus   = d.km_bus_semaine * semaines_an * 2 * FE.bus / 1000;
  const co2_train = d.km_train_an * FE.train / 1000;
  const co2_avion = d.km_avion_an * FE.avion_court / 1000;
  const transport_total = co2_voiture + co2_bus + co2_train + co2_avion;

  // ── Alimentation ───────────────────────────────────────
  const portions_boeuf   = d.repas_boeuf_semaine * 52 * 0.15;  // 150g/portion
  const portions_poulet  = d.repas_poulet_semaine * 52 * 0.15;
  const portions_poisson = d.repas_poisson_semaine * 52 * 0.15;

  const laitiers_facteur = { faible: 0.6, moyen: 1.0, fort: 1.5 };
  const co2_laitiers = 200 * laitiers_facteur[d.consommation_laitiers] * FE.lait / 1000;

  const alim_total = (
    portions_boeuf   * FE.boeuf   +
    portions_poulet  * FE.poulet  +
    portions_poisson * FE.poisson +
    co2_laitiers
  ) / 1000;

  // ── Logement ──────────────────────────────────────────
  const surface_par_pers = d.surface_m2 / Math.max(d.nb_personnes_foyer, 1);
  const co2_elec = d.kwh_elec_mois * 12 * FE.electricite / 1000
    / Math.max(d.nb_personnes_foyer, 1);
  const logement_total = co2_elec;

  // ── Numérique ─────────────────────────────────────────
  const co2_smartphones = d.nb_smartphones * (FE.smartphone_fab + FE.smartphone_usage);
  const co2_laptops     = d.nb_laptops     * (FE.laptop_fab + FE.laptop_usage);
  const co2_streaming   = d.heures_streaming_jour * 365 * FE.streaming_h;
  const numerique_total = (co2_smartphones + co2_laptops + co2_streaming) / 1000;

  const total = transport_total + alim_total + logement_total + numerique_total;

  return {
    transport:  +transport_total.toFixed(3),
    alim:       +alim_total.toFixed(3),
    logement:   +logement_total.toFixed(3),
    numerique:  +numerique_total.toFixed(3),
    total:      +total.toFixed(3),
    details: {
      voiture: +co2_voiture.toFixed(3),
      bus:     +co2_bus.toFixed(3),
      train:   +co2_train.toFixed(3),
      avion:   +co2_avion.toFixed(3),
    }
  };
}

/* ═══════════════════════════════════════════════════════════
   CONSEILS PERSONNALISÉS
═══════════════════════════════════════════════════════════ */
function genererConseils(data, result) {
  const conseils = [];

  if (result.details.voiture > 0.5) {
    conseils.push({
      icone: '🚌', priorite: 'haute', categorie: 'Transport',
      titre: 'Réduire les trajets en voiture',
      desc: `Votre voiture représente ${result.details.voiture.toFixed(2)} tCO₂e/an. Remplacer 2 jours/semaine par le bus réduirait vos émissions de ~30%.`,
      gain: +(result.details.voiture * 0.3).toFixed(2),
    });
  }
  if (data.km_avion_an > 2000) {
    conseils.push({
      icone: '✈', priorite: 'haute', categorie: 'Transport',
      titre: 'Limiter les voyages en avion',
      desc: `${data.km_avion_an.toLocaleString('fr-FR')} km/an en avion = ${result.details.avion.toFixed(2)} tCO₂e. Préférez le train pour les trajets < 700 km.`,
      gain: +(result.details.avion * 0.5).toFixed(2),
    });
  }
  if (data.repas_boeuf_semaine > 1) {
    const gain = (data.repas_boeuf_semaine - 1) * 52 * 0.15 * (FE.boeuf - FE.poulet) / 1000;
    conseils.push({
      icone: '🥗', priorite: 'moyenne', categorie: 'Alimentation',
      titre: 'Réduire la consommation de bœuf',
      desc: `Remplacer 1 repas de bœuf/semaine par du poulet ou du végétarien économise ${gain.toFixed(2)} tCO₂e/an.`,
      gain: +gain.toFixed(2),
    });
  }
  if (data.teletravail_jours < 2 && data.km_voiture_semaine > 40) {
    conseils.push({
      icone: '🏠', priorite: 'moyenne', categorie: 'Transport',
      titre: 'Augmenter le télétravail',
      desc: '2 jours de télétravail/semaine peuvent réduire vos émissions transport de 40%.',
      gain: +(result.details.voiture * 0.4).toFixed(2),
    });
  }
  if (data.heures_streaming_jour > 3) {
    conseils.push({
      icone: '📺', priorite: 'faible', categorie: 'Numérique',
      titre: 'Réduire le streaming vidéo',
      desc: `${data.heures_streaming_jour}h/jour de streaming = ${(data.heures_streaming_jour * 365 * FE.streaming_h / 1000).toFixed(3)} tCO₂e. Préférez la SD à la 4K.`,
      gain: +(data.heures_streaming_jour * 365 * FE.streaming_h * 0.4 / 1000).toFixed(3),
    });
  }

  // Toujours ajouter un conseil de base
  if (conseils.length < 2) {
    conseils.push({
      icone: '🌱', priorite: 'faible', categorie: 'Général',
      titre: 'Votre empreinte est déjà maîtrisée',
      desc: 'Continuez vos bonnes pratiques et partagez-les autour de vous pour amplifier l\'impact.',
      gain: 0,
    });
  }

  return conseils.sort((a, b) => b.gain - a.gain).slice(0, 4);
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANTS UI
═══════════════════════════════════════════════════════════ */
const PALETTE = {
  transport: '#1d6fb8', alim: '#336b12',
  logement:  '#c47d18', numerique: '#5b4fcf',
};


function NumInput({ label, value, onChange, min = 0, max = 9999, step = 1, unit = '', hint = '' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: '#44443f', marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: '100%', padding: '9px 12px', paddingRight: unit ? 52 : 12,
            border: '1.5px solid #e4e4e2', borderRadius: 9,
            fontSize: 14, fontFamily: 'DM Mono, monospace',
            outline: 'none', background: '#fff', color: '#111110',
          }}
          onFocus={e => e.target.style.borderColor = '#4a9119'}
          onBlur={e => e.target.style.borderColor = '#e4e4e2'}
        />
        {unit && (
          <span style={{
            position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
            fontSize: 11.5, color: '#888884', pointerEvents: 'none',
            fontFamily: 'DM Mono, monospace',
          }}>{unit}</span>
        )}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: '#888884', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function SelectInput({ label, value, onChange, options, hint = '' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: '#44443f', marginBottom: 5 }}>
        {label}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '9px 12px',
          border: '1.5px solid #e4e4e2', borderRadius: 9,
          fontSize: 14, fontFamily: 'DM Sans, system-ui, sans-serif',
          outline: 'none', background: '#fff', color: '#111110', cursor: 'pointer',
        }}
        onFocus={e => e.target.style.borderColor = '#4a9119'}
        onBlur={e => e.target.style.borderColor = '#e4e4e2'}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <div style={{ fontSize: 11.5, color: '#888884', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function StepIndicator({ step, current, label }) {
  const done    = current > step;
  const active  = current === step;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        background: done ? '#336b12' : active ? '#eef8e3' : '#f7f7f6',
        color:      done ? '#fff'    : active ? '#27520a' : '#b3b3ae',
        border:     active ? '2px solid #336b12' : 'none',
        transition: 'all 200ms ease',
      }}>
        {done ? '✓' : step}
      </div>
      <span style={{
        fontSize: 12.5, fontWeight: active ? 650 : 400,
        color: active ? '#27520a' : done ? '#44443f' : '#b3b3ae',
      }}>{label}</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e4e2', borderRadius: 9,
      padding: '10px 14px', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 700, color: '#111110', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill, fontFamily: 'DM Mono,monospace', fontWeight: 600 }}>
          {p.value} tCO₂e
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════ */
const ETAPES = ['Transport', 'Alimentation', 'Logement', 'Numérique', 'Résultats'];

export default function EmpreintePersonnelle() {
  const [step, setStep]   = useState(1);
  const [data, setData]   = useState(INITIAL);
  const [result, setResult] = useState(null);
  const [shared, setShared] = useState(false);

  const set = useCallback((k, v) => setData(d => ({ ...d, [k]: v })), []);

  const calculer = () => {
    const res = calculerEmpreinte(data);
    setResult(res);
    setStep(5);
  };

  const reinitialiser = () => {
    setData(INITIAL);
    setResult(null);
    setStep(1);
    setShared(false);
  };

  const conseils = result ? genererConseils(data, result) : [];

  const barData = result ? [
    { cat: 'Transport',   val: result.transport, fill: PALETTE.transport },
    { cat: 'Alimentation',val: result.alim,       fill: PALETTE.alim },
    { cat: 'Logement',    val: result.logement,   fill: PALETTE.logement },
    { cat: 'Numérique',   val: result.numerique,  fill: PALETTE.numerique },
  ] : [];

  const radarData = result ? [
    { subject: 'Transport',    A: Math.min(result.transport / 4 * 100, 100) },
    { subject: 'Alimentation', A: Math.min(result.alim      / 4 * 100, 100) },
    { subject: 'Logement',     A: Math.min(result.logement  / 2 * 100, 100) },
    { subject: 'Numérique',    A: Math.min(result.numerique / 1 * 100, 100) },
  ] : [];

  const scoreTotal    = result?.total || 0;
  const vsObjectif    = ((scoreTotal / OBJECTIF_PARIS - 1) * 100).toFixed(0);
  const vsMoyenne     = ((scoreTotal / MOYENNE_TN - 1) * 100).toFixed(0);
  const niveauColor   = scoreTotal < OBJECTIF_PARIS ? '#336b12'
                      : scoreTotal < MOYENNE_TN     ? '#c47d18' : '#b93232';
  const niveauLabel   = scoreTotal < OBJECTIF_PARIS ? 'Excellent — sous l\'objectif Paris'
                      : scoreTotal < MOYENNE_TN     ? 'Acceptable — des progrès possibles'
                      :                               'Élevé — actions recommandées';

  /* ── Styles ────────────────────────────────────────────── */
  const card = {
    background: '#fff', border: '1px solid #e4e4e2',
    borderRadius: 14, marginBottom: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  };
  const cardHeader = {
    padding: '14px 22px', borderBottom: '1px solid #f0f0ef',
    display: 'flex', alignItems: 'center', gap: 10,
  };
  const cardTitle = { fontSize: 14, fontWeight: 650, color: '#2e2e2b' };
  const cardBody  = { padding: '18px 22px' };

  const btnNext = {
    padding: '10px 24px', background: '#336b12', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 650,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(51,107,18,0.22)',
  };
  const btnBack = {
    padding: '10px 20px', background: '#f7f7f6', color: '#44443f',
    border: '1px solid #e4e4e2', borderRadius: 10, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  };

  /* ── RENDU ──────────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="pg-header">
        <div className="pg-header-row">
          <div>
            <h1 className="pg-title">Mon empreinte carbone personnelle</h1>
            <p className="pg-subtitle">
              Calculez, comprenez et réduisez votre impact environnemental individuel
            </p>
          </div>
          {step > 1 && step < 5 && (
            <button onClick={reinitialiser} style={btnBack}>↺ Recommencer</button>
          )}
          {step === 5 && (
            <button onClick={reinitialiser} style={btnBack}>↺ Nouveau calcul</button>
          )}
        </div>
      </div>

      {/* Indicateur d'étapes */}
      <div style={{
        ...card, padding: '16px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        {ETAPES.map((label, i) => (
          <React.Fragment key={label}>
            <StepIndicator step={i + 1} current={step} label={label} />
            {i < ETAPES.length - 1 && (
              <div style={{ flex: 1, height: 1, background: '#e4e4e2', minWidth: 20 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── ÉTAPE 1 : TRANSPORT ──────────────────────────────── */}
      {step === 1 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e8f3fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚗</div>
            <div style={cardTitle}>Transport — Vos déplacements quotidiens</div>
          </div>
          <div style={cardBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Voiture personnelle</div>
                <SelectInput label="Type de véhicule" value={data.type_voiture}
                  onChange={v => set('type_voiture', v)}
                  options={[
                    { value: 'voiture_essence', label: '⛽ Essence (0,218 kgCO₂e/km)' },
                    { value: 'voiture_diesel',  label: '⛽ Diesel (0,195 kgCO₂e/km)' },
                    { value: 'voiture_electrique', label: '⚡ Électrique (0,047 kgCO₂e/km)' },
                    { value: 'moto',            label: '🏍 Moto/Scooter (0,103 kgCO₂e/km)' },
                  ]}
                />
                <NumInput label="Distance aller domicile-campus"
                  value={data.km_voiture_semaine / 2 / 5} unit="km"
                  onChange={v => set('km_voiture_semaine', v * 2 * 5)}
                  hint="Distance aller simple · ex : 8 km" min={0} max={200}
                />
                <NumInput label="Jours de télétravail / semaine"
                  value={data.teletravail_jours} unit="j/sem"
                  onChange={v => set('teletravail_jours', Math.min(v, 5))}
                  hint="Réduit les émissions de déplacement" min={0} max={5}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Transports en commun & longue distance</div>
                <NumInput label="Bus / TCT par semaine"
                  value={data.km_bus_semaine} unit="km/sem"
                  onChange={v => set('km_bus_semaine', v)}
                  hint="Facteur : 0,029 kgCO₂e/km"
                />
                <NumInput label="Train par an"
                  value={data.km_train_an} unit="km/an"
                  onChange={v => set('km_train_an', v)}
                  hint="Facteur : 0,011 kgCO₂e/km"
                />
                <NumInput label="Avion par an"
                  value={data.km_avion_an} unit="km/an"
                  onChange={v => set('km_avion_an', v)}
                  hint="Court-courrier : 0,258 kgCO₂e/km"
                />
              </div>
            </div>

            {/* Aperçu rapide */}
            <div style={{
              background: '#f7f7f6', borderRadius: 10, padding: '12px 16px',
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#636360' }}>Émissions transport estimées :</span>
              <span style={{
                fontFamily: 'DM Mono,monospace', fontWeight: 750, fontSize: 18,
                color: PALETTE.transport,
              }}>
                {calculerEmpreinte(data).transport.toFixed(2)} tCO₂e/an
              </span>
            </div>
          </div>
          <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnNext} onClick={() => setStep(2)}>Suivant — Alimentation →</button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 2 : ALIMENTATION ───────────────────────────── */}
      {step === 2 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef8e3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🥩</div>
            <div style={cardTitle}>Alimentation — Habitudes alimentaires hebdomadaires</div>
          </div>
          <div style={cardBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Viandes (repas / semaine)</div>
                <NumInput label="Repas avec du bœuf / agneau"
                  value={data.repas_boeuf_semaine} unit="repas"
                  onChange={v => set('repas_boeuf_semaine', Math.min(v, 14))}
                  hint="Bœuf : 27 kgCO₂e/kg — le plus émetteur"
                  min={0} max={14}
                />
                <NumInput label="Repas avec du poulet / dinde"
                  value={data.repas_poulet_semaine} unit="repas"
                  onChange={v => set('repas_poulet_semaine', Math.min(v, 14))}
                  hint="Poulet : 4,5 kgCO₂e/kg"
                  min={0} max={14}
                />
                <NumInput label="Repas avec du poisson"
                  value={data.repas_poisson_semaine} unit="repas"
                  onChange={v => set('repas_poisson_semaine', Math.min(v, 14))}
                  hint="Poisson : 2,7 kgCO₂e/kg"
                  min={0} max={14}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Produits laitiers & végétaux</div>
                <SelectInput label="Consommation de produits laitiers"
                  value={data.consommation_laitiers}
                  onChange={v => set('consommation_laitiers', v)}
                  options={[
                    { value: 'faible', label: '🥛 Faible — peu de fromage/lait' },
                    { value: 'moyen',  label: '🧀 Moyen — consommation standard' },
                    { value: 'fort',   label: '🍦 Élevé — fromage/yaourt quotidien' },
                  ]}
                  hint="Fromage : 9,8 kgCO₂e/kg"
                />
                <div style={{
                  background: '#eef8e3', borderRadius: 10, padding: '14px 16px', marginTop: 8,
                  border: '1px solid #a8d97a',
                }}>
                  <div style={{ fontSize: 13, color: '#27520a', fontWeight: 600, marginBottom: 6 }}>
                    🌱 Conseil alimentation
                  </div>
                  <div style={{ fontSize: 12.5, color: '#336b12', lineHeight: 1.5 }}>
                    Remplacer 2 repas de bœuf/semaine par des légumineuses économise jusqu'à
                    <strong> 0.7 tCO₂e/an</strong> — soit ~25% de l'empreinte alimentaire moyenne.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f7f7f6', borderRadius: 10, padding: '12px 16px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#636360' }}>Émissions alimentation estimées :</span>
              <span style={{ fontFamily: 'DM Mono,monospace', fontWeight: 750, fontSize: 18, color: PALETTE.alim }}>
                {calculerEmpreinte(data).alim.toFixed(2)} tCO₂e/an
              </span>
            </div>
          </div>
          <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'space-between' }}>
            <button style={btnBack} onClick={() => setStep(1)}>← Retour</button>
            <button style={btnNext} onClick={() => setStep(3)}>Suivant — Logement →</button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : LOGEMENT ──────────────────────────────── */}
      {step === 3 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#faeeda', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏠</div>
            <div style={cardTitle}>Logement — Consommation d'énergie</div>
          </div>
          <div style={cardBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
              <div>
                <NumInput label="Surface de votre logement"
                  value={data.surface_m2} unit="m²"
                  onChange={v => set('surface_m2', v)} min={10} max={500}
                />
                <NumInput label="Nombre de personnes dans le foyer"
                  value={data.nb_personnes_foyer} unit="pers."
                  onChange={v => set('nb_personnes_foyer', Math.max(v, 1))}
                  hint="Divise les émissions du logement"
                  min={1} max={20}
                />
              </div>
              <div>
                <SelectInput label="Mode de chauffage principal"
                  value={data.type_chauffage}
                  onChange={v => set('type_chauffage', v)}
                  options={[
                    { value: 'electricite', label: '⚡ Électrique (réseau STEG)' },
                    { value: 'gaz',         label: '🔥 Gaz naturel' },
                    { value: 'fioul',       label: '🛢 Fioul domestique' },
                    { value: 'climatiseur', label: '❄ Climatiseur réversible' },
                  ]}
                />
                <NumInput label="Consommation électrique mensuelle"
                  value={data.kwh_elec_mois} unit="kWh"
                  onChange={v => set('kwh_elec_mois', v)}
                  hint="Facteur réseau STEG : 0,559 kgCO₂e/kWh"
                  min={0} max={2000}
                />
              </div>
            </div>

            <div style={{ background: '#f7f7f6', borderRadius: 10, padding: '12px 16px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#636360' }}>Émissions logement estimées :</span>
              <span style={{ fontFamily: 'DM Mono,monospace', fontWeight: 750, fontSize: 18, color: PALETTE.logement }}>
                {calculerEmpreinte(data).logement.toFixed(2)} tCO₂e/an
              </span>
            </div>
          </div>
          <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'space-between' }}>
            <button style={btnBack} onClick={() => setStep(2)}>← Retour</button>
            <button style={btnNext} onClick={() => setStep(4)}>Suivant — Numérique →</button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 4 : NUMÉRIQUE ─────────────────────────────── */}
      {step === 4 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eeedfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💻</div>
            <div style={cardTitle}>Numérique — Équipements et usages</div>
          </div>
          <div style={cardBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Équipements possédés</div>
                <NumInput label="Nombre de smartphones"
                  value={data.nb_smartphones} unit="appareils"
                  onChange={v => set('nb_smartphones', Math.max(v, 0))}
                  hint="Fabrication : 70 kgCO₂e · Usage : 8 kgCO₂e/an"
                  min={0} max={10}
                />
                <NumInput label="Nombre d'ordinateurs"
                  value={data.nb_laptops} unit="appareils"
                  onChange={v => set('nb_laptops', Math.max(v, 0))}
                  hint="Fabrication : 156 kgCO₂e · Usage : 23 kgCO₂e/an"
                  min={0} max={10}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Usages quotidiens</div>
                <NumInput label="Streaming vidéo quotidien"
                  value={data.heures_streaming_jour} unit="h/jour"
                  onChange={v => set('heures_streaming_jour', Math.min(v, 24))}
                  hint="0,036 kgCO₂e/h · La 4K consomme 4× plus"
                  min={0} max={24} step={0.5}
                />
                <div style={{
                  background: '#eeedfe', borderRadius: 10, padding: '13px 15px', marginTop: 4,
                  border: '1px solid #d3cffc', fontSize: 12.5, color: '#534AB7', lineHeight: 1.5,
                }}>
                  💡 <strong>Saviez-vous ?</strong> La fabrication d'un smartphone représente
                  90% de son empreinte totale. Garder son téléphone 1 an de plus réduit
                  son impact de moitié.
                </div>
              </div>
            </div>

            <div style={{ background: '#f7f7f6', borderRadius: 10, padding: '12px 16px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#636360' }}>Émissions numérique estimées :</span>
              <span style={{ fontFamily: 'DM Mono,monospace', fontWeight: 750, fontSize: 18, color: PALETTE.numerique }}>
                {calculerEmpreinte(data).numerique.toFixed(2)} tCO₂e/an
              </span>
            </div>
          </div>
          <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'space-between' }}>
            <button style={btnBack} onClick={() => setStep(3)}>← Retour</button>
            <button
              style={{ ...btnNext, background: '#27520a', padding: '11px 28px', fontSize: 15 }}
              onClick={calculer}
            >
              🌿 Calculer mon empreinte →
            </button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 5 : RÉSULTATS ─────────────────────────────── */}
      {step === 5 && result && (
        <>
          {/* Score principal */}
          <div style={{
            ...card,
            background: `linear-gradient(135deg, ${niveauColor}12 0%, ${niveauColor}06 100%)`,
            border: `1px solid ${niveauColor}30`,
            padding: '28px 32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Votre empreinte carbone annuelle
                </div>
                <div style={{
                  fontSize: 60, fontWeight: 800, color: niveauColor,
                  fontFamily: 'DM Mono, monospace', letterSpacing: '-2px', lineHeight: 1,
                }}>
                  {scoreTotal}
                  <span style={{ fontSize: 22, fontWeight: 400, color: niveauColor, opacity: 0.7, marginLeft: 8 }}>tCO₂e/an</span>
                </div>
                <div style={{
                  marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                  background: `${niveauColor}18`, color: niveauColor,
                  border: `1px solid ${niveauColor}30`,
                }}>
                  {niveauLabel}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888884', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Comparaison
                </div>
                {[
                  { label: 'Objectif Accord de Paris', ref: OBJECTIF_PARIS, color: '#336b12' },
                  { label: 'Moyenne tunisienne', ref: MOYENNE_TN, color: '#c47d18' },
                ].map(item => {
                  const diff = scoreTotal - item.ref;
                  const signe = diff > 0 ? '+' : '';
                  const couleur = diff > 0 ? '#b93232' : '#336b12';
                  return (
                    <div key={item.label} style={{
                      background: '#fff', borderRadius: 9, padding: '10px 14px',
                      border: '1px solid #e4e4e2',
                    }}>
                      <div style={{ fontSize: 12, color: '#636360', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontFamily: 'DM Mono,monospace', fontWeight: 700, color: item.color }}>
                          {item.ref} tCO₂e
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: couleur }}>
                          {signe}{diff.toFixed(2)} ({signe}{((diff / item.ref) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Graphiques */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Barres par catégorie */}
            <div style={card}>
              <div style={cardHeader}>
                <div style={{ ...cardTitle }}>Répartition par catégorie</div>
              </div>
              <div style={cardBody}>
                {barData.map(d => (
                  <div key={d.cat} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: '#44443f', fontWeight: 500 }}>{d.cat}</span>
                      <span style={{ fontFamily: 'DM Mono,monospace', fontWeight: 700, color: d.fill }}>
                        {d.val} tCO₂e
                        <span style={{ color: '#888884', fontWeight: 400, marginLeft: 5 }}>
                          ({((d.val / scoreTotal) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#f0f0ef', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(d.val / Math.max(...barData.map(x => x.val))) * 100}%`,
                        background: d.fill, borderRadius: 99,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: '12px 14px', background: '#f7f7f6', borderRadius: 9 }}>
                  <div style={{ fontSize: 11.5, color: '#636360', lineHeight: 1.55 }}>
                    <strong style={{ color: '#44443f' }}>Source principale :</strong>{' '}
                    {barData.sort((a, b) => b.val - a.val)[0]?.cat} représente{' '}
                    {((barData.sort((a, b) => b.val - a.val)[0]?.val / scoreTotal) * 100).toFixed(0)}%
                    de vos émissions totales.
                  </div>
                </div>
              </div>
            </div>

            {/* Radar */}
            <div style={card}>
              <div style={cardHeader}>
                <div style={cardTitle}>Profil d'impact</div>
              </div>
              <div style={cardBody}>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e4e4e2" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#636360' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="A" stroke="#336b12" fill="#336b12" fillOpacity={0.18} strokeWidth={2} dot={{ r: 4, fill: '#336b12' }} />
                  </RadarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11.5, color: '#888884', textAlign: 'center', marginTop: -8 }}>
                  Score relatif — 100% = seuil d'alerte par catégorie
                </div>
              </div>
            </div>
          </div>

          {/* Conseils personnalisés */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eef8e3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>◆</div>
              <div style={cardTitle}>Recommandations personnalisées</div>
              <span style={{
                marginLeft: 'auto', padding: '3px 10px', borderRadius: 99,
                background: '#eef8e3', color: '#27520a', border: '1px solid #a8d97a',
                fontSize: 11.5, fontWeight: 700,
              }}>
                {conseils.reduce((s, c) => s + c.gain, 0).toFixed(2)} tCO₂e réductibles
              </span>
            </div>
            <div style={{ padding: '14px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {conseils.map((c, i) => (
                <div key={i} style={{
                  background: '#f9f9f8', border: '1px solid #e4e4e2', borderRadius: 11,
                  padding: '14px 16px', position: 'relative', overflow: 'hidden',
                  borderLeft: `3px solid ${{ haute: '#b93232', moyenne: '#c47d18', faible: '#336b12' }[c.priorite] || '#336b12'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 650, fontSize: 13.5, color: '#2e2e2b' }}>
                      {c.icone} {c.titre}
                    </div>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: { haute: '#fceee8', moyenne: '#faeeda', faible: '#eef8e3' }[c.priorite],
                      color:      { haute: '#b93232', moyenne: '#c47d18', faible: '#336b12' }[c.priorite],
                      flexShrink: 0,
                    }}>
                      {c.priorite}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#636360', lineHeight: 1.55, marginBottom: 8 }}>
                    {c.desc}
                  </div>
                  {c.gain > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#336b12' }}>
                      Gain potentiel : −{c.gain} tCO₂e/an
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Partage avec le campus */}
          {!shared && (
            <div style={{
              ...card,
              background: 'linear-gradient(135deg, #eef8e3 0%, #e4f5d5 100%)',
              border: '1px solid #a8d97a',
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#27520a', marginBottom: 4 }}>
                  🌿 Contribuer au bilan carbone collectif du campus
                </div>
                <div style={{ fontSize: 13, color: '#336b12', lineHeight: 1.5 }}>
                  Partagez votre résultat mobilité de façon anonyme pour enrichir les données Scope 3 de l'ENSIT.
                </div>
              </div>
              <button
                onClick={() => { setShared(true); }}
                style={{
                  padding: '10px 20px', background: '#336b12', color: '#fff', border: 'none',
                  borderRadius: 10, fontSize: 13.5, fontWeight: 650, cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                Partager anonymement
              </button>
            </div>
          )}
          {shared && (
            <div style={{
              ...card,
              background: '#eef8e3', border: '1px solid #a8d97a',
              padding: '16px 22px',
              display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 13.5, color: '#27520a',
            }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <span>
                Votre résultat mobilité a été partagé anonymement avec l'équipe campus.
                Merci pour votre contribution au suivi Scope 3 de l'ENSIT !
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
