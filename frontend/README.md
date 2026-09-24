# Frontend — Gestion Locative Bailleur

React (Vite) + Tailwind CSS + Framer Motion + React Router.

## Démarrage

1. `npm install`
2. `npm run dev`
3. Ouvrir http://localhost:5173

Le serveur de développement redirige automatiquement toutes les requêtes
`/api/...` vers le backend Express sur `http://localhost:4000` (voir
`vite.config.js`) — pense à lancer aussi le backend (`npm run dev` dans
`backend/`) pour que le tableau de bord affiche "Connecté".

## Structure

```
src/
  api/          client axios (baseURL /api, ajoute le jeton JWT automatiquement)
  auth/         AuthContext (compte bailleur connecté, connexion/déconnexion)
  components/
    layout/     Sidebar, Topbar, Layout (structure commune à toutes les pages)
    ui/         composants réutilisables (Card, StatCard, Badge, Modal, Champ)
  pages/        une page par section (Connexion, Dashboard, Biens, Locataires, Paiements)
  App.jsx       routes (react-router-dom) + protection des pages internes
```

## Où en est le frontend

- `Connexion.jsx` : écran de connexion / création de compte bailleur.
- `Biens.jsx` : branché sur les vraies routes API — quartiers, maisons/cours et
  chambres, avec ajout/modification/suppression et un prix + statut par chambre.
- `Dashboard.jsx` : chambres occupées/libres calculées à partir des vraies données.

## Prochaine étape

`Locataires.jsx` et `Paiements.jsx` restent des squelettes, prêts à être branchés
sur les routes API correspondantes côté backend dès qu'elles existent.
