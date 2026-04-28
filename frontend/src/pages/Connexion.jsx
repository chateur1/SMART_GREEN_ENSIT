import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { auth as authApi } from '../api/client';
import toast from 'react-hot-toast';

/* ─── Styles ─────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  html { -webkit-font-smoothing: antialiased; }

  .auth-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 500px;
    font-family: 'DM Sans', system-ui, sans-serif;
    background: #f7f7f6;
  }

  /* ── Panneau gauche ── */
  .auth-left {
    background: linear-gradient(160deg, #0d2106 0%, #162d08 35%, #1a3f0a 70%, #1e4a0d 100%);
    display: flex; flex-direction: column;
    padding: 48px 56px;
    position: relative; overflow: hidden;
  }
  .auth-left::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 20% 20%, rgba(74,145,25,0.18) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 80%, rgba(30,74,13,0.3) 0%, transparent 50%);
    pointer-events: none;
  }
  .auth-left::after {
    content: '';
    position: absolute; bottom: -80px; right: -80px;
    width: 400px; height: 400px; border-radius: 50%;
    border: 1px solid rgba(109,184,44,0.08);
    box-shadow:
      inset 0 0 0 40px rgba(109,184,44,0.03),
      inset 0 0 0 80px rgba(109,184,44,0.02);
  }

  .brand-header { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
  .brand-logo {
    width: 40px; height: 40px; border-radius: 11px;
    background: linear-gradient(135deg, #4a9119, #6db82c);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; box-shadow: 0 4px 16px rgba(109,184,44,0.4);
  }
  .brand-name { color: #fff; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .brand-sub  { color: rgba(255,255,255,0.45); font-size: 12px; margin-top: 1px; }

  .auth-left-body {
    flex: 1; display: flex; flex-direction: column;
    justify-content: center; position: relative; z-index: 1;
  }
  .auth-headline {
    font-size: 38px; font-weight: 750; color: #fff;
    letter-spacing: -1.2px; line-height: 1.15; margin-bottom: 18px;
  }
  .auth-headline em { color: #6db82c; font-style: normal; }
  .auth-desc { font-size: 16px; color: rgba(255,255,255,0.5); line-height: 1.65; max-width: 380px; }

  .feature-list { margin-top: 36px; display: flex; flex-direction: column; gap: 14px; }
  .feature-item { display: flex; align-items: flex-start; gap: 12px; }
  .feature-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #6db82c; flex-shrink: 0; margin-top: 7px;
    box-shadow: 0 0 0 3px rgba(109,184,44,0.2);
  }
  .feature-text { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.5; }
  .feature-text strong { color: rgba(255,255,255,0.85); font-weight: 600; }

  .auth-left-footer { position: relative; z-index: 1; }
  .compliance-badges { display: flex; gap: 10px; flex-wrap: wrap; }
  .cbadge {
    padding: 5px 12px; border-radius: 99px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.45); font-size: 11px; font-weight: 500;
  }

  /* ── Panneau droit ── */
  .auth-right {
    background: #fff;
    display: flex; flex-direction: column;
    border-left: 1px solid #e4e4e2;
    box-shadow: -8px 0 40px rgba(0,0,0,0.04);
    overflow-y: auto;
  }

  /* ── Onglets ── */
  .auth-tabs {
    display: flex;
    border-bottom: 1px solid #e4e4e2;
    flex-shrink: 0;
  }
  .auth-tab {
    flex: 1; padding: 18px 20px; text-align: center;
    font-size: 14px; font-weight: 600; cursor: pointer;
    border: none; background: none;
    font-family: 'DM Sans', system-ui, sans-serif;
    transition: all 180ms ease;
    position: relative;
    color: #888884;
  }
  .auth-tab:hover { color: #336b12; background: #fafaf9; }
  .auth-tab.active {
    color: #27520a;
    background: #fff;
  }
  .auth-tab.active::after {
    content: '';
    position: absolute; bottom: -1px; left: 0; right: 0; height: 2px;
    background: #336b12; border-radius: 2px 2px 0 0;
  }

  /* ── Corps du formulaire ── */
  .auth-body { flex: 1; padding: 32px 36px; }

  .auth-form-title {
    font-size: 22px; font-weight: 700; color: #111110;
    letter-spacing: -0.4px; margin-bottom: 5px;
  }
  .auth-form-sub { font-size: 13.5px; color: #888884; line-height: 1.5; margin-bottom: 28px; }

  /* Champs */
  .f-group { margin-bottom: 18px; }
  .f-label {
    display: block; font-size: 12.5px; font-weight: 650;
    color: #44443f; margin-bottom: 6px;
  }
  .f-input {
    width: 100%; padding: 10px 14px;
    border: 1.5px solid #e4e4e2; border-radius: 10px;
    font-size: 14.5px; font-family: 'DM Sans', system-ui, sans-serif;
    color: #111110; background: #fff; outline: none;
    transition: all 180ms ease;
  }
  .f-input:hover { border-color: #b3b3ae; }
  .f-input:focus { border-color: #4a9119; box-shadow: 0 0 0 3px rgba(74,145,25,0.1); }
  .f-input::placeholder { color: #c4c4bf; }
  .f-input.error { border-color: #f5c4b5; box-shadow: 0 0 0 3px rgba(185,50,50,0.07); }
  .f-error { font-size: 12px; color: #b93232; margin-top: 4px; }
  .f-hint  { font-size: 12px; color: #888884; margin-top: 4px; }

  /* Indicateur force mot de passe */
  .pwd-strength { margin-top: 8px; }
  .pwd-strength-bar {
    height: 4px; border-radius: 99px;
    background: #e4e4e2; overflow: hidden; margin-bottom: 4px;
  }
  .pwd-strength-fill {
    height: 100%; border-radius: 99px;
    transition: all 300ms ease;
  }
  .pwd-strength-label { font-size: 11.5px; font-weight: 600; }

  /* Bouton principal */
  .auth-btn {
    width: 100%; padding: 13px;
    background: #336b12; color: #fff; border: none;
    border-radius: 10px; font-size: 15px; font-weight: 650;
    font-family: 'DM Sans', system-ui, sans-serif;
    cursor: pointer; letter-spacing: -0.1px;
    transition: all 180ms ease;
    box-shadow: 0 2px 8px rgba(51,107,18,0.25);
    margin-top: 6px;
  }
  .auth-btn:hover:not(:disabled) {
    background: #27520e;
    box-shadow: 0 4px 16px rgba(51,107,18,0.3);
    transform: translateY(-1px);
  }
  .auth-btn:active { transform: translateY(0); }
  .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

  /* Erreur globale */
  .auth-error {
    background: #fceee8; border: 1px solid #f5c4b5;
    border-radius: 9px; padding: 11px 14px;
    font-size: 13.5px; color: #7a1f1f;
    margin-bottom: 18px;
    display: flex; align-items: flex-start; gap: 8px;
  }

  /* Séparateur */
  .auth-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 22px 0; font-size: 12px; color: #b3b3ae;
    font-weight: 500; text-transform: uppercase; letter-spacing: 0.6px;
  }
  .auth-divider::before, .auth-divider::after {
    content: ''; flex: 1; height: 1px; background: #e4e4e2;
  }

  /* Comptes démo */
  .demo-title { font-size: 11.5px; font-weight: 700; color: #888884; margin-bottom: 8px;
    text-transform: uppercase; letter-spacing: 0.5px; }
  .demo-list { display: flex; flex-direction: column; gap: 6px; }
  .demo-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px;
    border: 1.5px solid #ebebea; border-radius: 9px;
    cursor: pointer; background: #f7f7f6;
    transition: all 180ms ease;
  }
  .demo-item:hover { background: #eef8e3; border-color: #a8d97a; }
  .demo-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; flex-shrink: 0;
  }
  .demo-info { flex: 1; min-width: 0; }
  .demo-email { font-size: 12.5px; font-weight: 600; color: #2e2e2b; }
  .demo-pwd   { font-size: 11px; color: #888884; font-family: 'DM Mono', monospace; margin-top: 1px; }
  .demo-badge {
    font-size: 10.5px; font-weight: 700; padding: 2px 8px;
    border-radius: 99px; text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0;
  }

  /* Notice rôle inscription */
  .role-notice {
    background: #f7f7f6; border: 1px solid #ebebea;
    border-radius: 9px; padding: 11px 14px;
    font-size: 12.5px; color: #636360; line-height: 1.55;
    margin-bottom: 18px; display: flex; gap: 8px; align-items: flex-start;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .auth-page { grid-template-columns: 1fr; }
    .auth-left  { display: none; }
    .auth-body  { padding: 24px 20px; }
  }
`;

/* ─── Données démo ───────────────────────────────────────── */
const DEMO_ACCOUNTS = [
  {
    email: 'admin@ensit.tn', pwd: 'Admin2026!', role: 'admin',
    label: 'Administrateur',
    avatarBg: '#336b12', avatarColor: '#fff',
    badgeBg: '#eef8e3', badgeColor: '#27520a',
  },
  {
    email: 'gestionnaire@ensit.tn', pwd: 'Gest2026!', role: 'manager',
    label: 'Gestionnaire',
    avatarBg: '#e8f3fd', avatarColor: '#1d6fb8',
    badgeBg: '#e8f3fd', badgeColor: '#0d3f6e',
  },
  {
    email: 'lecteur@ensit.tn', pwd: 'Lect2026!', role: 'viewer',
    label: 'Lecteur',
    avatarBg: '#ebebea', avatarColor: '#636360',
    badgeBg: '#ebebea', badgeColor: '#44443f',
  },
];

/* ─── Utilitaires ────────────────────────────────────────── */
function initiales(str = '') {
  return str.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
}

function forceMdp(mdp) {
  if (!mdp) return { score: 0, label: '', color: '#e4e4e2', pct: 0 };
  let score = 0;
  if (mdp.length >= 8)  score++;
  if (mdp.length >= 12) score++;
  if (/[A-Z]/.test(mdp)) score++;
  if (/[0-9]/.test(mdp)) score++;
  if (/[^A-Za-z0-9]/.test(mdp)) score++;
  const niveaux = [
    { label: '', color: '#e4e4e2', pct: 0 },
    { label: 'Très faible', color: '#b93232', pct: 20 },
    { label: 'Faible', color: '#c47d18', pct: 40 },
    { label: 'Moyen', color: '#c4b418', pct: 60 },
    { label: 'Fort', color: '#4a9119', pct: 80 },
    { label: 'Très fort', color: '#27520a', pct: 100 },
  ];
  return niveaux[Math.min(score, 5)];
}

/* ════════════════════════════════════════════════════════════
   FORMULAIRE CONNEXION
════════════════════════════════════════════════════════════ */
function FormConnexion({ onSuccess }) {
  const [email, setEmail]   = useState('');
  const [pwd, setPwd]       = useState('');
  const [loading, setLoading] = useState(false);
  const { connexion, erreur, effacerErreur } = useAuthStore();

  const submit = async (em, pw) => {
    setLoading(true);
    effacerErreur?.();
    try {
      await connexion(em, pw);
      toast.success('Connexion établie');
      onSuccess();
    } catch { /* géré dans le store */ }
    finally { setLoading(false); }
  };

  return (
    <>
      <h2 className="auth-form-title">Accès à la plateforme</h2>
      <p className="auth-form-sub">
        Connectez-vous avec vos identifiants institutionnels ENSIT.
      </p>

      {erreur && (
        <div className="auth-error">
          <span>⚠</span><span>{erreur}</span>
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); submit(email, pwd); }}>
        <div className="f-group">
          <label className="f-label">Adresse e-mail</label>
          <input className="f-input" type="email" autoFocus
            placeholder="prenom.nom@ensit.tn"
            value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="f-group">
          <label className="f-label">Mot de passe</label>
          <input className="f-input" type="password"
            placeholder="••••••••••"
            value={pwd} onChange={e => setPwd(e.target.value)} required />
        </div>
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Authentification…' : 'Se connecter →'}
        </button>
      </form>

      <div className="auth-divider">Accès démonstration</div>
      <div className="demo-title">Comptes disponibles</div>
      <div className="demo-list">
        {DEMO_ACCOUNTS.map(acc => (
          <div key={acc.email} className="demo-item"
            onClick={() => submit(acc.email, acc.pwd)}>
            <div className="demo-avatar"
              style={{ background: acc.avatarBg, color: acc.avatarColor }}>
              {initiales(acc.label)}
            </div>
            <div className="demo-info">
              <div className="demo-email">{acc.email}</div>
              <div className="demo-pwd">{acc.pwd}</div>
            </div>
            <div className="demo-badge"
              style={{ background: acc.badgeBg, color: acc.badgeColor }}>
              {acc.label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   FORMULAIRE INSCRIPTION
════════════════════════════════════════════════════════════ */
function FormInscription({ onSuccess }) {
  const [form, setForm] = useState({
    nom_complet: '', email: '', mot_de_passe: '', confirmer: '',
  });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const { connexion }         = useAuthStore();

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: null, global: null }));
  };

  const force = forceMdp(form.mot_de_passe);

  const valider = () => {
    const e = {};
    if (form.nom_complet.trim().length < 3)
      e.nom_complet = 'Le nom doit contenir au moins 3 caractères';
    if (!form.email.includes('@') || !form.email.includes('.'))
      e.email = 'Adresse e-mail invalide';
    if (form.mot_de_passe.length < 8)
      e.mot_de_passe = 'Le mot de passe doit contenir au moins 8 caractères';
    if (form.mot_de_passe !== form.confirmer)
      e.confirmer = 'Les deux mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async e => {
    e.preventDefault();
    if (!valider()) return;
    setLoading(true);
    try {
      const { data } = await authApi.inscription(
        form.email, form.nom_complet, form.mot_de_passe,
      );
      // FIX BUG 5: stocker les tokens directement depuis la réponse
      // sans rappeler connexion() — évite le double-appel API
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      // Mettre à jour le store directement avec les données reçues
      useAuthStore.setState({
        token: data.access_token,
        utilisateur: {
          email: form.email,
          role: data.role,
          nomComplet: data.nom_complet,
        },
        erreur: null,
      });
      toast.success(`Bienvenue, ${data.nom_complet} !`);
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erreur lors de la création du compte';
      setErrors(e => ({ ...e, global: msg }));
    } finally { setLoading(false); }
  };

  return (
    <>
      <h2 className="auth-form-title">Créer un compte</h2>
      <p className="auth-form-sub">
        Accédez à la plateforme Smart Green ENSIT en quelques secondes.
      </p>

      <div className="role-notice">
        <span style={{ fontSize: 15 }}>ℹ</span>
        <span>
          Votre compte sera créé avec un accès <strong>Lecteur</strong> —
          consultation du tableau de bord et des rapports.
          Un administrateur peut vous attribuer un niveau supérieur.
        </span>
      </div>

      {errors.global && (
        <div className="auth-error">
          <span>⚠</span><span>{errors.global}</span>
        </div>
      )}

      <form onSubmit={submit}>
        <div className="f-group">
          <label className="f-label">Nom complet</label>
          <input className={`f-input${errors.nom_complet ? ' error' : ''}`}
            type="text" autoFocus
            placeholder="Prénom Nom"
            value={form.nom_complet}
            onChange={e => set('nom_complet', e.target.value)} required />
          {errors.nom_complet && <div className="f-error">{errors.nom_complet}</div>}
        </div>

        <div className="f-group">
          <label className="f-label">Adresse e-mail</label>
          <input className={`f-input${errors.email ? ' error' : ''}`}
            type="email"
            placeholder="prenom.nom@ensit.tn"
            value={form.email}
            onChange={e => set('email', e.target.value)} required />
          {errors.email && <div className="f-error">{errors.email}</div>}
        </div>

        <div className="f-group">
          <label className="f-label">Mot de passe</label>
          <input className={`f-input${errors.mot_de_passe ? ' error' : ''}`}
            type="password"
            placeholder="8 caractères minimum"
            value={form.mot_de_passe}
            onChange={e => set('mot_de_passe', e.target.value)} required />
          {form.mot_de_passe && (
            <div className="pwd-strength">
              <div className="pwd-strength-bar">
                <div className="pwd-strength-fill"
                  style={{ width: `${force.pct}%`, background: force.color }} />
              </div>
              <div className="pwd-strength-label" style={{ color: force.color }}>
                {force.label}
              </div>
            </div>
          )}
          {errors.mot_de_passe && <div className="f-error">{errors.mot_de_passe}</div>}
        </div>

        <div className="f-group">
          <label className="f-label">Confirmer le mot de passe</label>
          <input className={`f-input${errors.confirmer ? ' error' : ''}`}
            type="password"
            placeholder="Répéter le mot de passe"
            value={form.confirmer}
            onChange={e => set('confirmer', e.target.value)} required />
          {errors.confirmer && <div className="f-error">{errors.confirmer}</div>}
          {form.confirmer && form.mot_de_passe === form.confirmer && !errors.confirmer && (
            <div className="f-hint" style={{ color: '#4a9119' }}>✓ Les mots de passe correspondent</div>
          )}
        </div>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Création du compte…' : 'Créer mon compte →'}
        </button>
      </form>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
════════════════════════════════════════════════════════════ */
export default function Connexion() {
  const [onglet, setOnglet] = useState('connexion');

  // Afficher un message si la session a expiré
  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired');
      toast('Votre session a expiré. Veuillez vous reconnecter.', { icon: '⏱' });
    }
  }, []); // 'connexion' | 'inscription'
  const navigate = useNavigate();

  const handleSuccess = () => navigate('/tableau-de-bord');

  return (
    <>
      <style>{CSS}</style>
      <div className="auth-page">

        {/* ── Panneau gauche ── */}
        <div className="auth-left">
          <div className="brand-header">
            <div className="brand-logo">🌿</div>
            <div>
              <div className="brand-name">Smart Green ENSIT</div>
              <div className="brand-sub">Carbon Intelligence Platform</div>
            </div>
          </div>

          <div className="auth-left-body">
            <h1 className="auth-headline">
              Pilotez votre<br />empreinte<br /><em>carbone</em>.
            </h1>
            <p className="auth-desc">
              Plateforme institutionnelle de calcul, suivi et simulation
              des émissions GES du campus — conforme GHG Protocol.
            </p>
            <div className="feature-list">
              {[
                ['Calcul automatisé', 'Scopes 1, 2 & 3 — facteurs ADEME Base Carbone'],
                ['Prédiction par IA', 'Régression linéaire, anomalies, prévisions 5 ans'],
                ['Simulation de scénarios', 'Évaluation de l\'impact avant mise en œuvre'],
                ['Export institutionnel', 'Rapports PDF & Excel conformes aux référentiels'],
              ].map(([titre, desc]) => (
                <div className="feature-item" key={titre}>
                  <div className="feature-dot" />
                  <div className="feature-text">
                    <strong>{titre}</strong> — {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-left-footer">
            <div className="compliance-badges">
              {['GHG Protocol', 'ADEME Base Carbone', 'ISO 14064', 'ENSIT 2026'].map(b => (
                <div className="cbadge" key={b}>{b}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Panneau droit ── */}
        <div className="auth-right">

          {/* Onglets */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${onglet === 'connexion' ? ' active' : ''}`}
              onClick={() => setOnglet('connexion')}
            >
              Se connecter
            </button>
            <button
              className={`auth-tab${onglet === 'inscription' ? ' active' : ''}`}
              onClick={() => setOnglet('inscription')}
            >
              Créer un compte
            </button>
          </div>

          {/* Corps */}
          <div className="auth-body">
            {onglet === 'connexion'
              ? <FormConnexion  onSuccess={handleSuccess} />
              : <FormInscription onSuccess={handleSuccess} />
            }
          </div>

        </div>
      </div>
    </>
  );
}
