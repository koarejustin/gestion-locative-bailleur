import { createContext, useContext, useEffect, useState } from "react";

const AuthContextLocataire = createContext(null);

function lireLocataireStocke() {
  try {
    const brut = localStorage.getItem("locataire");
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export function AuthProviderLocataire({ children }) {
  const [locataire, setLocataire] = useState(lireLocataireStocke);

  useEffect(() => {
    function surNonAutorise() {
      deconnecter();
    }
    window.addEventListener("auth-locataire:non-autorise", surNonAutorise);
    return () => window.removeEventListener("auth-locataire:non-autorise", surNonAutorise);
  }, []);

  function connecter(jeton, locataireConnecte) {
    localStorage.setItem("jetonLocataire", jeton);
    localStorage.setItem("locataire", JSON.stringify(locataireConnecte));
    setLocataire(locataireConnecte);
  }

  function deconnecter() {
    localStorage.removeItem("jetonLocataire");
    localStorage.removeItem("locataire");
    setLocataire(null);
  }

  return (
    <AuthContextLocataire.Provider value={{ locataire, connecter, deconnecter }}>
      {children}
    </AuthContextLocataire.Provider>
  );
}

export function useAuthLocataire() {
  const contexte = useContext(AuthContextLocataire);
  if (!contexte) {
    throw new Error("useAuthLocataire doit être utilisé à l'intérieur de <AuthProviderLocataire>.");
  }
  return contexte;
}
