import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import client from '../api/client';
import toast from 'react-hot-toast';

// ── Couleurs par rôle ─────────────────────────────────────
const ROLES = {
  admin:   { label: 'Administrateur', bg: '#eef8e3', color: '#27520a', border: '#a8d97a' },
  manager: { label: 'Gestionnaire',   bg: '#e8f3fd', color: '#0d3f6e', border: '#bcd8f5' },
  viewer:  { label: 'Lecteur',        bg: '#f0f0ef', color: '#44443f', border: '#d4d4cf' },
};

const ROLE_OPTIONS = [
  { value: 'admin',   label: '👑 Administrateur — Accès complet' },
  { value: 'manager', label: '⚙️  Gestionnaire — Saisie + analyse' },
  { value: 'viewer',  label: '👁️  Lecteur — Consultation seule' },
];

// ── Composants utilitaires ────────────────────────────────
function RoleBadge({ role }) {
  const r = ROLES[role] || ROLES.viewer;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11.5, fontWeight: 700,
      background: r.bg, color: r.color,
      border: `1px solid ${r.border}`,
    }}>
      {r.label}
    </span>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e4e2',
      borderRadius: 12, padding: '16px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 32, fontWeight: 750, color,
        fontFamily: 'DM Mono, monospace', letterSpacing: '-1px', lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888884', marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ── Modale création / édition ────────────────────────────
function Modale({ mode, user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    email:        user?.email || '',
    nom_complet:  user?.nom_complet || '',
    mot_de_passe: '',
    role:         user?.role || 'viewer',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: null }));
  };

  const valider = () => {
    const e = {};
    if (!form.nom_complet.trim() || form.nom_complet.trim().length < 3)
      e.nom_complet = 'Le nom doit contenir au moins 3 caractères';
    if (mode === 'creer') {
      if (!form.email.includes('@'))
        e.email = 'Adresse e-mail invalide';
      if (form.mot_de_passe.length < 8)
        e.mot_de_passe = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!valider()) return;
    setLoading(true);
    try {
      if (mode === 'creer') {
        await client.post('/auth/utilisateurs', form);
        toast.success(`Compte créé : ${form.email}`);
      } else {
        await client.put(`/auth/utilisateurs/${user.email}`, {
          nom_complet: form.nom_complet,
          role:        form.role,
        });
        toast.success('Compte mis à jour');
      }
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erreur serveur';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, id, children, error }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 12.5, fontWeight: 600,
        color: '#44443f', marginBottom: 6,
      }}>{label}</label>
      {children}
      {error && (
        <div style={{ fontSize: 12, color: '#b93232', marginTop: 4 }}>⚠ {error}</div>
      )}
    </div>
  );

  const inputStyle = (err) => ({
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${err ? '#f5c4b5' : '#e4e4e2'}`,
    borderRadius: 9, fontSize: 14,
    fontFamily: 'DM Sans, system-ui, sans-serif',
    outline: 'none', background: '#fff', color: '#111110',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,10,9,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f0f0ef',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111110' }}>
              {mode === 'creer' ? 'Créer un compte utilisateur' : 'Modifier le compte'}
            </div>
            <div style={{ fontSize: 12.5, color: '#888884', marginTop: 2 }}>
              {mode === 'creer'
                ? 'Le compte sera actif immédiatement'
                : `Modification de ${user?.email}`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#f7f7f6', border: '1px solid #e4e4e2',
            borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
            fontSize: 16, color: '#636360', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          <Field label="Nom complet" error={errors.nom_complet}>
            <input
              style={inputStyle(errors.nom_complet)}
              type="text" placeholder="Prénom Nom"
              value={form.nom_complet}
              onChange={e => set('nom_complet', e.target.value)}
              autoFocus
            />
          </Field>

          {mode === 'creer' && (
            <Field label="Adresse e-mail" error={errors.email}>
              <input
                style={inputStyle(errors.email)}
                type="email" placeholder="prenom.nom@ensit.tn"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </Field>
          )}

          <Field label="Rôle et niveau d'accès">
            <select
              style={{ ...inputStyle(null), cursor: 'pointer' }}
              value={form.role}
              onChange={e => set('role', e.target.value)}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          {mode === 'creer' && (
            <Field label="Mot de passe" error={errors.mot_de_passe}>
              <input
                style={inputStyle(errors.mot_de_passe)}
                type="password" placeholder="8 caractères minimum"
                value={form.mot_de_passe}
                onChange={e => set('mot_de_passe', e.target.value)}
              />
            </Field>
          )}

          {/* Aperçu du rôle sélectionné */}
          <div style={{
            background: '#f7f7f6', borderRadius: 9, padding: '11px 14px',
            fontSize: 12.5, color: '#636360', lineHeight: 1.55,
            border: '1px solid #ebebea',
          }}>
            {{
              admin:   '👑 Accès complet — tableau de bord, saisie, IA, scénarios, export, gestion des comptes.',
              manager: '⚙️  Saisie + analyse — saisie de données, analyse IA, scénarios, export. Pas de gestion des comptes.',
              viewer:  '👁️  Lecture seule — consultation du tableau de bord, analyse IA et export. Pas de saisie.',
            }[form.role]}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f0f0ef',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 9,
            background: '#f7f7f6', border: '1px solid #e4e4e2',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: '#44443f',
          }}>Annuler</button>
          <button onClick={submit} disabled={loading} style={{
            padding: '9px 22px', borderRadius: 9,
            background: loading ? '#88b870' : '#336b12',
            border: 'none', color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 180ms ease',
          }}>
            {loading ? 'Enregistrement…' : mode === 'creer' ? 'Créer le compte' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modale changement de mot de passe (admin) ────────────
function ModaleMdp({ user, onClose, onSuccess }) {
  const [mdp, setMdp]       = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const submit = async () => {
    if (mdp.length < 8) { setErr('8 caractères minimum'); return; }
    setLoading(true);
    try {
      await client.post(`/auth/utilisateurs/${user.email}/reinitialiser-mdp`, {
        nouveau_mot_de_passe: mdp,
      });
      toast.success(`Mot de passe réinitialisé pour ${user.email}`);
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(10,10,9,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0ef' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111110' }}>
            Réinitialiser le mot de passe
          </div>
          <div style={{ fontSize: 12.5, color: '#888884', marginTop: 2 }}>
            Compte : {user.email}
          </div>
        </div>
        <div style={{ padding: '22px 24px' }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#44443f', display: 'block', marginBottom: 6 }}>
            Nouveau mot de passe
          </label>
          <input
            type="password" placeholder="8 caractères minimum"
            value={mdp} onChange={e => { setMdp(e.target.value); setErr(''); }}
            autoFocus
            style={{
              width: '100%', padding: '9px 12px',
              border: `1.5px solid ${err ? '#f5c4b5' : '#e4e4e2'}`,
              borderRadius: 9, fontSize: 14,
              fontFamily: 'DM Sans, system-ui, sans-serif',
              outline: 'none',
            }}
          />
          {err && <div style={{ fontSize: 12, color: '#b93232', marginTop: 4 }}>⚠ {err}</div>}
        </div>
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f0f0ef',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 9, background: '#f7f7f6',
            border: '1px solid #e4e4e2', fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', color: '#44443f',
          }}>Annuler</button>
          <button onClick={submit} disabled={loading} style={{
            padding: '9px 22px', borderRadius: 9,
            background: loading ? '#6090d0' : '#1d6fb8',
            border: 'none', color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}>
            {loading ? 'Enregistrement…' : 'Réinitialiser'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function GestionComptes() {
  const { utilisateur } = useAuthStore();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [modale, setModale]       = useState(null); // null | 'creer' | 'editer' | 'mdp'
  const [userSelec, setUserSelec] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState('tous');

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const r = await client.get('/auth/utilisateurs');
      setData(r.data);
    } catch (e) {
      if (e.response?.status === 403) {
        toast.error('Accès réservé aux administrateurs');
      } else {
        toast.error('Impossible de charger les comptes');
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const fermerEtRecharger = () => { setModale(null); setUserSelec(null); charger(); };

  const [confirmAction, setConfirmAction] = React.useState(null);

  // FIX BUG 6: séparer "demander confirmation" et "confirmer l'action"
  const demanderDesactivation = (email) => {
    setConfirmAction({ email, action: 'desactiver' });
  };

  const confirmerDesactivation = async () => {
    if (!confirmAction) return;
    const email = confirmAction.email;
    setConfirmAction(null);
    try {
      await client.delete(`/auth/utilisateurs/${email}`);
      toast.success(`Compte ${email} désactivé`);
      charger();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur');
    }
  };

  // Garde pour compatibilité avec les anciens appels
  const desactiver = (email) => demanderDesactivation(email);

  const reactiver = async (email) => {
    try {
      await client.post(`/auth/utilisateurs/${email}/reactiver`);
      toast.success(`Compte ${email} réactivé`);
      charger();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur');
    }
  };

  // Filtrage
  const utilisateurs = (data?.utilisateurs || []).filter(u => {
    const matchRecherche = u.nom_complet.toLowerCase().includes(recherche.toLowerCase())
      || u.email.toLowerCase().includes(recherche.toLowerCase());
    const matchRole = filtreRole === 'tous' || u.role === filtreRole;
    return matchRecherche && matchRole;
  });

  const stats = data?.stats || {};

  // Guard : non-admin
  if (utilisateur?.role !== 'admin') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh', gap: 12,
      }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#44443f' }}>Accès restreint</div>
        <div style={{ fontSize: 13.5, color: '#888884' }}>
          Cette page est réservée aux administrateurs.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Modales */}
      {modale === 'creer' && (
        <Modale mode="creer" user={null} onClose={() => setModale(null)} onSuccess={fermerEtRecharger} />
      )}
      {modale === 'editer' && userSelec && (
        <Modale mode="editer" user={userSelec} onClose={() => { setModale(null); setUserSelec(null); }} onSuccess={fermerEtRecharger} />
      )}
      {modale === 'mdp' && userSelec && (
        <ModaleMdp user={userSelec} onClose={() => { setModale(null); setUserSelec(null); }} onSuccess={fermerEtRecharger} />
      )}

      {/* Header page */}
      <div className="pg-header">
        <div className="pg-header-row">
          <div>
            <h1 className="pg-title">Gestion des comptes</h1>
            <p className="pg-subtitle">
              Création, modification et accès des utilisateurs de la plateforme
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setModale('creer')}
          >
            + Nouveau compte
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard value={stats.total   || 0} label="Comptes total"    color="#111110" />
          <StatCard value={stats.actifs  || 0} label="Comptes actifs"   color="#336b12" />
          <StatCard value={stats.inactifs|| 0} label="Comptes inactifs" color="#b93232" />
          <StatCard value={stats.admins  || 0} label="Administrateurs"  color="#c47d18" />
          <StatCard value={stats.managers|| 0} label="Gestionnaires"    color="#1d6fb8" />
        </div>
      )}

      {/* Tableau */}
      <div className="card">
        {/* Barre de recherche + filtres */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #f0f0ef',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <span style={{
              position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: '#b3b3ae', pointerEvents: 'none',
            }}>🔍</span>
            <input
              style={{
                width: '100%', padding: '8px 12px 8px 32px',
                border: '1.5px solid #e4e4e2', borderRadius: 8,
                fontSize: 13.5, outline: 'none',
                fontFamily: 'DM Sans, system-ui, sans-serif',
              }}
              placeholder="Rechercher par nom ou email…"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['tous', 'admin', 'manager', 'viewer'].map(r => (
              <button key={r} onClick={() => setFiltreRole(r)} style={{
                padding: '6px 13px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
                background: filtreRole === r ? '#336b12' : '#fff',
                color:      filtreRole === r ? '#fff'    : '#636360',
                borderColor: filtreRole === r ? '#336b12' : '#e4e4e2',
                transition: 'all 180ms ease',
              }}>
                {r === 'tous' ? 'Tous' : ROLES[r]?.label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: '#888884' }}>
            {utilisateurs.length} compte{utilisateurs.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#b3b3ae', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>◈</div>
            Chargement des comptes…
          </div>
        ) : utilisateurs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#b3b3ae', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>👤</div>
            Aucun compte trouvé
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th>Créé par</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map(u => {
                const estMoi = u.email === utilisateur?.email;
                return (
                  <tr key={u.id}>
                    {/* Avatar + nom */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: ROLES[u.role]?.bg || '#f0f0ef',
                          border: `1px solid ${ROLES[u.role]?.border || '#e4e4e2'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                          color: ROLES[u.role]?.color || '#636360',
                        }}>
                          {u.nom_complet.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: '#2e2e2b' }}>
                            {u.nom_complet}
                            {estMoi && (
                              <span style={{
                                marginLeft: 7, fontSize: 10.5, fontWeight: 700,
                                background: '#eef8e3', color: '#27520a',
                                border: '1px solid #a8d97a',
                                padding: '1px 6px', borderRadius: 99,
                              }}>moi</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="mono" style={{ fontSize: 13, color: '#636360' }}>{u.email}</td>

                    <td><RoleBadge role={u.role} /></td>

                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12, fontWeight: 600,
                        color: u.actif ? '#27520a' : '#888884',
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: u.actif ? '#4a9119' : '#b3b3ae',
                          display: 'inline-block',
                        }}/>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>

                    <td style={{ fontSize: 12.5, color: '#888884' }}>
                      {u.cree_le ? new Date(u.cree_le).toLocaleDateString('fr-FR') : '—'}
                    </td>

                    <td style={{ fontSize: 12.5, color: '#888884' }}>{u.cree_par || '—'}</td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {/* Modifier */}
                        <button
                          onClick={() => { setUserSelec(u); setModale('editer'); }}
                          style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                            background: '#f7f7f6', border: '1px solid #e4e4e2',
                            color: '#44443f', cursor: 'pointer', transition: 'all 180ms ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ebebea'}
                          onMouseLeave={e => e.currentTarget.style.background = '#f7f7f6'}
                        >
                          Modifier
                        </button>

                        {/* Réinitialiser MDP */}
                        <button
                          onClick={() => { setUserSelec(u); setModale('mdp'); }}
                          style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                            background: '#e8f3fd', border: '1px solid #bcd8f5',
                            color: '#1d6fb8', cursor: 'pointer', transition: 'all 180ms ease',
                          }}
                        >
                          MDP
                        </button>

                        {/* Désactiver / Réactiver */}
                        {!estMoi && (
                          u.actif ? (
                            <button
                              onClick={() => demanderDesactivation(u.email)}
                              style={{
                                padding: '5px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                                background: '#fceee8', border: '1px solid #f5c4b5',
                                color: '#b93232', cursor: 'pointer',
                              }}
                            >
                              Désactiver
                            </button>
                          ) : (
                            <button
                              onClick={() => reactiver(u.email)}
                              style={{
                                padding: '5px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                                background: '#eef8e3', border: '1px solid #a8d97a',
                                color: '#336b12', cursor: 'pointer',
                              }}
                            >
                              Réactiver
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale de confirmation */}
      {confirmAction && (
        <div style={{
          position:'fixed', inset:0, zIndex:300,
          background:'rgba(10,10,9,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24,
        }} onClick={() => setConfirmAction(null)}>
          <div style={{
            background:'#fff', borderRadius:14, padding:'28px 32px',
            maxWidth:400, width:'100%',
            boxShadow:'0 24px 64px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:700,color:'#111110',marginBottom:8}}>
              Confirmer la désactivation
            </div>
            <p style={{fontSize:13.5,color:'#636360',lineHeight:1.6,marginBottom:20}}>
              Voulez-vous désactiver le compte <strong>{confirmAction.email}</strong> ?
              Cette action peut être annulée à tout moment.
            </p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setConfirmAction(null)} style={{
                padding:'9px 18px',borderRadius:9,background:'#f7f7f6',
                border:'1px solid #e4e4e2',fontSize:13.5,fontWeight:600,cursor:'pointer',color:'#44443f',
              }}>Annuler</button>
              <button onClick={confirmerDesactivation} style={{
                padding:'9px 18px',borderRadius:9,background:'#b93232',
                border:'none',color:'#fff',fontSize:13.5,fontWeight:600,cursor:'pointer',
              }}>Désactiver</button>
            </div>
          </div>
        </div>
      )}

      {/* Note de bas de page */}
      <div style={{
        marginTop: 16, padding: '11px 16px',
        background: '#f7f7f6', borderRadius: 10,
        border: '1px solid #ebebea', fontSize: 12.5, color: '#888884',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>ℹ</span>
        <span>
          La désactivation d'un compte empêche la connexion sans supprimer les données.
          Les comptes peuvent être réactivés à tout moment.
          Les mots de passe ne sont jamais stockés en clair.
        </span>
      </div>
    </div>
  );
}
