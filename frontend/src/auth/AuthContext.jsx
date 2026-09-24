import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

function lireBailleurStocke() {
  try {
    const brut = localStorage.getItem("bailleur");
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [bailleur, setBailleur] = useState(lireBailleurStocke);

  // Déconnexion automatique si le backend renvoie "non autorisé"
  // (jeton expiré ou invalide) — voir api/client.js.
  useEffect(() => {
    function surNonAutorise() {
      deconnecter();
    }
    window.addEventListener("auth:non-autorise", surNonAutorise);
    return () => window.removeEventListener("auth:non-autorise", surNonAutorise);
  }, []);

  function connecter(jeton, bailleurConnecte) {
    localStorage.setItem("jeton", jeton);
    localStorage.setItem("bailleur", JSON.stringify(bailleurConnecte));
    setBailleur(bailleurConnecte);
  }

  function deconnecter() {
    localStorage.removeItem("jeton");
    localStorage.removeItem("bailleur");
    setBailleur(null);
  }

  // Met à jour certains champs du bailleur connecté (ex. photo_url après un
  // envoi/retrait de photo) sans repasser par une reconnexion complète.
  function mettreAJourBailleur(champs) {
    setBailleur((prev) => {
      if (!prev) return prev;
      const maj = { ...prev, ...champs };
      localStorage.setItem("bailleur", JSON.stringify(maj));
      return maj;
    });
  }

  return (
    <AuthContext.Provider value={{ bailleur, connecter, deconnecter, mettreAJourBailleur }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexte = useContext(AuthContext);
  if (!contexte) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.");
  }
  return contexte;
}
