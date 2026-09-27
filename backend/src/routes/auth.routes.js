const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const authentifier = require("../middleware/auth");
const { genererJetonBailleur, genererJetonLocataire } = require("../services/jetons");
const { upload, dossierUploads } = require("../middleware/upload");

const router = express.Router();

// Cette application est prévue pour un seul bailleur par déploiement (pas
// multi-tenant) : une fois qu'un compte existe, l'inscription publique est
// fermée. Sans ça, n'importe qui tombant sur le site pouvait se créer un
// compte bailleur avec accès complet, et le vrai bailleur pouvait finir
// avec plusieurs comptes séparés (chacun avec ses propres biens, isolés
// les uns des autres) sans s'en rendre compte.
router.get("/existe-bailleur", async (req, res) => {
  try {
    const r = await pool.query(`SELECT EXISTS(SELECT 1 FROM comptes.bailleurs) AS existe`);
    res.json({ ok: true, existe: r.rows[0].existe });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Création du compte bailleur (une seule fois : la toute première utilisation de l'app)
router.post("/inscription", async (req, res) => {
  const { nom_complet, telephone, email, mot_de_passe } = req.body;

  if (!nom_complet || !telephone || !mot_de_passe) {
    return res.status(400).json({
      ok: false,
      error: "Nom complet, téléphone et mot de passe sont obligatoires.",
    });
  }
  if (mot_de_passe.length < 6) {
    return res.status(400).json({
      ok: false,
      error: "Le mot de passe doit faire au moins 6 caractères.",
    });
  }

  try {
    const dejaUnCompte = await pool.query(`SELECT EXISTS(SELECT 1 FROM comptes.bailleurs) AS existe`);
    if (dejaUnCompte.rows[0].existe) {
      return res.status(409).json({
        ok: false,
        error: "Un compte bailleur existe déjà pour cette application. Connecte-toi avec ce compte au lieu d'en créer un nouveau.",
      });
    }

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const resultat = await pool.query(
      `INSERT INTO comptes.bailleurs (nom_complet, telephone, email, mot_de_passe_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nom_complet, telephone, email, email_verifie, photo_url`,
      [nom_complet, telephone, email || null, hash]
    );
    const bailleur = resultat.rows[0];

    res.status(201).json({ ok: true, jeton: genererJetonBailleur(bailleur), bailleur });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Un compte existe déjà avec ce téléphone ou cet email.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Connexion avec téléphone + mot de passe
router.post("/connexion", async (req, res) => {
  const { telephone, mot_de_passe } = req.body;

  if (!telephone || !mot_de_passe) {
    return res.status(400).json({ ok: false, error: "Téléphone et mot de passe requis." });
  }

  try {
    const resultat = await pool.query(
      `SELECT id, nom_complet, telephone, email, email_verifie, photo_url, mot_de_passe_hash
       FROM comptes.bailleurs WHERE telephone = $1`,
      [telephone]
    );
    const bailleur = resultat.rows[0];
    if (!bailleur) {
      return res.status(401).json({ ok: false, error: "Téléphone ou mot de passe incorrect." });
    }

    const motDePasseValide = await bcrypt.compare(mot_de_passe, bailleur.mot_de_passe_hash);
    if (!motDePasseValide) {
      return res.status(401).json({ ok: false, error: "Téléphone ou mot de passe incorrect." });
    }

    delete bailleur.mot_de_passe_hash;
    res.json({ ok: true, jeton: genererJetonBailleur(bailleur), bailleur });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Espace locataire ---
// Le locataire n'a pas de mot de passe au départ : le bailleur lui génère un
// code d'accès à 6 chiffres (voir /api/location/locataires/:id/code-acces).
// Le locataire l'utilise une seule fois pour activer son compte et choisir
// son propre mot de passe.

router.post("/locataire/activer", async (req, res) => {
  const { telephone, code, mot_de_passe } = req.body;
  if (!telephone || !code || !mot_de_passe) {
    return res.status(400).json({
      ok: false,
      error: "Téléphone, code d'accès et nouveau mot de passe sont obligatoires.",
    });
  }
  if (mot_de_passe.length < 6) {
    return res.status(400).json({
      ok: false,
      error: "Le mot de passe doit faire au moins 6 caractères.",
    });
  }

  try {
    // Un même téléphone peut correspondre à plusieurs fiches locataire
    // (plusieurs bailleurs, ou plusieurs chambres) : on cherche celle dont
    // le code d'accès (encore valable) correspond.
    const resultat = await pool.query(
      `SELECT id, nom_complet, code_acces_hash, code_acces_expire
       FROM location.locataires
       WHERE telephone = $1 AND code_acces_hash IS NOT NULL`,
      [telephone]
    );

    let locataireTrouve = null;
    for (const ligne of resultat.rows) {
      if (ligne.code_acces_expire && new Date(ligne.code_acces_expire) < new Date()) continue;
      if (await bcrypt.compare(code, ligne.code_acces_hash)) {
        locataireTrouve = ligne;
        break;
      }
    }

    if (!locataireTrouve) {
      return res.status(401).json({
        ok: false,
        error: "Code d'accès invalide ou expiré. Demande un nouveau code à ton bailleur.",
      });
    }

    const hash = await bcrypt.hash(mot_de_passe, 10);
    await pool.query(
      `UPDATE location.locataires
       SET mot_de_passe_hash = $1, compte_actif = true, code_acces_hash = NULL, code_acces_expire = NULL
       WHERE id = $2`,
      [hash, locataireTrouve.id]
    );

    const locataire = { id: locataireTrouve.id, nom_complet: locataireTrouve.nom_complet };
    res.status(201).json({ ok: true, jeton: genererJetonLocataire(locataire), locataire });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/locataire/connexion", async (req, res) => {
  const { telephone, mot_de_passe } = req.body;
  if (!telephone || !mot_de_passe) {
    return res.status(400).json({ ok: false, error: "Téléphone et mot de passe requis." });
  }

  try {
    const resultat = await pool.query(
      `SELECT id, nom_complet, mot_de_passe_hash
       FROM location.locataires
       WHERE telephone = $1 AND compte_actif = true`,
      [telephone]
    );

    let locataireTrouve = null;
    for (const ligne of resultat.rows) {
      if (await bcrypt.compare(mot_de_passe, ligne.mot_de_passe_hash)) {
        locataireTrouve = ligne;
        break;
      }
    }

    if (!locataireTrouve) {
      return res.status(401).json({ ok: false, error: "Téléphone ou mot de passe incorrect." });
    }

    const locataire = { id: locataireTrouve.id, nom_complet: locataireTrouve.nom_complet };
    res.json({ ok: true, jeton: genererJetonLocataire(locataire), locataire });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Photo de profil du bailleur (même principe que celle du locataire) ---

router.post("/ma-photo", authentifier, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "Aucune photo reçue." });
  }
  try {
    const ancien = await pool.query(
      `SELECT photo_url FROM comptes.bailleurs WHERE id = $1`,
      [req.bailleurId]
    );
    const url = `/uploads/${req.file.filename}`;
    await pool.query(`UPDATE comptes.bailleurs SET photo_url = $1 WHERE id = $2`, [
      url,
      req.bailleurId,
    ]);
    const ancienUrl = ancien.rows[0]?.photo_url;
    if (ancienUrl) {
      // Best-effort : si le fichier a déjà disparu du disque, ce n'est pas grave.
      fs.unlink(path.join(dossierUploads, path.basename(ancienUrl)), () => {});
    }
    res.status(201).json({ ok: true, photo_url: url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/ma-photo", authentifier, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT photo_url FROM comptes.bailleurs WHERE id = $1`,
      [req.bailleurId]
    );
    const url = r.rows[0]?.photo_url;
    if (!url) return res.json({ ok: true });

    await pool.query(`UPDATE comptes.bailleurs SET photo_url = NULL WHERE id = $1`, [
      req.bailleurId,
    ]);
    fs.unlink(path.join(dossierUploads, path.basename(url)), () => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
