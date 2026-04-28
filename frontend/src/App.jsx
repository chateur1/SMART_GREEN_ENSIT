import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import Connexion from './pages/Connexion';
import TableauDeBord from './pages/TableauDeBord';
import SaisieScope1 from './pages/SaisieScope1';
import SaisieScope2 from './pages/SaisieScope2';
import EnqueteMobilite from './pages/EnqueteMobilite';
import AnalyseIA from './pages/AnalyseIA';
import Scenarios from './pages/Scenarios';
import Rapports from './pages/Rapports';
import GestionComptes from './pages/GestionComptes';
import EmpreintePersonnelle from './pages/EmpreintePersonnelle';
import Layout from './components/layout/Layout';


function Page404() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f7f7f6', fontFamily: "'DM Sans', system-ui, sans-serif",
      gap: 16,
    }}>
      <div style={{ fontSize: 64, opacity: 0.2 }}>🌿</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2e2e2b', letterSpacing: '-0.4px' }}>
        Page introuvable
      </h1>
      <p style={{ fontSize: 14, color: '#888884', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
        Cette page n'existe pas ou vous n'avez pas les droits pour y accéder.
      </p>
      <a href="/tableau-de-bord" style={{
        marginTop: 8, padding: '10px 22px',
        background: '#336b12', color: '#fff', borderRadius: 10,
        textDecoration: 'none', fontSize: 14, fontWeight: 600,
      }}>
        ← Retour au tableau de bord
      </a>
    </div>
  );
}

function RouteProtegee({ children }) {
  const estConnecte = useAuthStore((state) => state.estConnecte);
  return estConnecte() ? children : <Navigate to="/connexion" replace />;
}

export default function App() {
  const chargerProfil = useAuthStore((state) => state.chargerProfil);
  useEffect(() => { chargerProfil(); }, [chargerProfil]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        success: { iconTheme: { primary: '#3B6D11', secondary: '#fff' } },
      }} />
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/" element={<RouteProtegee><Layout /></RouteProtegee>}>
          <Route index element={<Navigate to="/tableau-de-bord" replace />} />
          <Route path="tableau-de-bord"        element={<TableauDeBord />} />
          <Route path="saisie/scope1"           element={<SaisieScope1 />} />
          <Route path="saisie/scope2"           element={<SaisieScope2 />} />
          <Route path="saisie/enquete-mobilite" element={<EnqueteMobilite />} />
          <Route path="analyse-ia"              element={<AnalyseIA />} />
          <Route path="scenarios"               element={<Scenarios />} />
          <Route path="rapports"                element={<Rapports />} />
          <Route path="comptes"                 element={<GestionComptes />} />
          <Route path="empreinte-personnelle"    element={<EmpreintePersonnelle />} />
        </Route>
        <Route path="*" element={<Page404 />} />
      </Routes>
    </BrowserRouter>
  );
}
