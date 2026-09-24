import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { AuthProviderLocataire, useAuthLocataire } from "./auth/AuthContextLocataire.jsx";
import Layout from "./components/layout/Layout.jsx";
import Connexion from "./pages/Connexion.jsx";
import MotDePasseOublie from "./pages/MotDePasseOublie.jsx";
import VerifierEmail from "./pages/VerifierEmail.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Biens from "./pages/Biens.jsx";
import Locataires from "./pages/Locataires.jsx";
import Paiements from "./pages/Paiements.jsx";
import ConnexionLocataire from "./pages/locataire/ConnexionLocataire.jsx";
import ActiverCompteLocataire from "./pages/locataire/ActiverCompteLocataire.jsx";
import EspaceLocataire from "./pages/locataire/EspaceLocataire.jsx";
import Louer from "./pages/public/Louer.jsx";

const TITRES = {
  "/": "Tableau de bord",
  "/biens": "Biens",
  "/locataires": "Locataires",
  "/paiements": "Paiements",
};

function Page({ chemin, children }) {
  return <Layout titre={TITRES[chemin]}>{children}</Layout>;
}

// Bloque l'accès aux pages internes tant que le bailleur n'est pas connecté.
function RouteProtegee({ children }) {
  const { bailleur } = useAuth();
  if (!bailleur) {
    return <Navigate to="/connexion" replace />;
  }
  return children;
}

// Même principe côté locataire (compte, mot de passe séparés du bailleur).
function RouteProtegeeLocataire({ children }) {
  const { locataire } = useAuthLocataire();
  if (!locataire) {
    return <Navigate to="/locataire/connexion" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthProviderLocataire>
        <BrowserRouter>
          <Routes>
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/verifier-email" element={<VerifierEmail />} />
            <Route
              path="/"
              element={
                <RouteProtegee>
                  <Page chemin="/">
                    <Dashboard />
                  </Page>
                </RouteProtegee>
              }
            />
            <Route
              path="/biens"
              element={
                <RouteProtegee>
                  <Page chemin="/biens">
                    <Biens />
                  </Page>
                </RouteProtegee>
              }
            />
            <Route
              path="/locataires"
              element={
                <RouteProtegee>
                  <Page chemin="/locataires">
                    <Locataires />
                  </Page>
                </RouteProtegee>
              }
            />
            <Route
              path="/paiements"
              element={
                <RouteProtegee>
                  <Page chemin="/paiements">
                    <Paiements />
                  </Page>
                </RouteProtegee>
              }
            />

            {/* Vitrine publique : consultation des biens disponibles, sans connexion */}
            <Route path="/louer" element={<Louer />} />

            {/* Espace locataire : compte et connexion séparés de l'espace bailleur */}
            <Route path="/locataire/connexion" element={<ConnexionLocataire />} />
            <Route path="/locataire/activer" element={<ActiverCompteLocataire />} />
            <Route
              path="/locataire"
              element={
                <RouteProtegeeLocataire>
                  <EspaceLocataire />
                </RouteProtegeeLocataire>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProviderLocataire>
    </AuthProvider>
  );
}
