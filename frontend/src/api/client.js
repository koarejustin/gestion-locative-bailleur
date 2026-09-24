import axios from "axios";

// Toutes les requêtes passent par /api, redirigé vers le backend Express
// par le proxy Vite en développement (voir vite.config.js).
const api = axios.create({
  baseURL: "/api",
});

// Deux espaces (bailleur / locataire) partagent cette même instance axios,
// chacun avec son propre jeton stocké séparément dans le localStorage — on
// choisit lequel envoyer selon le chemin de la requête.
function estRouteLocataire(url = "") {
  return url.startsWith("/espace-locataire") || url.startsWith("/auth/locataire");
}

// Ajoute automatiquement le bon jeton de connexion sur chaque requête.
api.interceptors.request.use((config) => {
  const cle = estRouteLocataire(config.url) ? "jetonLocataire" : "jeton";
  const jeton = localStorage.getItem(cle);
  if (jeton) {
    config.headers.Authorization = `Bearer ${jeton}`;
  }
  return config;
});

// Si le backend répond "non autorisé" (jeton absent/expiré), on prévient
// l'application pour renvoyer la bonne personne (bailleur ou locataire)
// vers son écran de connexion.
api.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    if (erreur.response?.status === 401) {
      const evenement = estRouteLocataire(erreur.config?.url)
        ? "auth-locataire:non-autorise"
        : "auth:non-autorise";
      window.dispatchEvent(new Event(evenement));
    }
    return Promise.reject(erreur);
  }
);

export default api;
