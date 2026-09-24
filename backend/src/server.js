require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const authentifier = require("./middleware/auth");
const authRoutes = require("./routes/auth.routes");
const biensRoutes = require("./routes/biens.routes");
const locationRoutes = require("./routes/location.routes");
const paiementsRoutes = require("./routes/paiements.routes");
const espaceLocataireRoutes = require("./routes/espace-locataire.routes");
const publicRoutes = require("./routes/public.routes");
const { dossierUploads } = require("./middleware/upload");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(dossierUploads));

// Vérifie que le serveur ET la base de données répondent bien
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connectee" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/biens", authentifier, biensRoutes);
app.use("/api/location", authentifier, locationRoutes);
app.use("/api/paiements", authentifier, paiementsRoutes);
app.use("/api/espace-locataire", authentifier.authentifierLocataire, espaceLocataireRoutes);
app.use("/api/public", publicRoutes);

// En production (Render), le frontend construit (frontend/dist) est servi
// directement par ce même serveur : une seule URL, pas de souci de CORS
// entre deux domaines différents. En développement, ce dossier n'existe
// pas encore (le frontend tourne séparément avec "npm run dev" sur le port
// 5173) donc ce bloc est simplement ignoré.
const dossierFrontend = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(dossierFrontend)) {
  app.use(express.static(dossierFrontend));
  // Toute autre route (hors /api et /uploads) renvoie index.html, pour que
  // le routeur React (react-router) gère la navigation côté client.
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(dossierFrontend, "index.html"));
  });
}

// Filet de sécurité : une erreur d'upload (photo trop lourde, mauvais format...)
// doit renvoyer du JSON comme le reste de l'API, pas une page d'erreur HTML.
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ ok: false, error: err.message || "Requête invalide." });
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
