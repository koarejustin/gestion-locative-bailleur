const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { envoyerEmailVerification, envoyerMotDePasseTemporaire } = require("../services/email");
const authentifier = require("../middleware/auth");
const { genererJetonBailleur, genererJetonLocataire } = require("../services/jetons");
const { upload, dossierUploads } = require("../middleware/upload");

const router = express.Router();

const DUREE_TOKEN_VERIFICATION_MS = 24 * 60 * 60 * 1000; // 24h
const DELAI_MIN_ENTRE_DEMANDES_MS = 2 * 60 * 1000; // anti-spam : 2 min entre deux demandes de reset

function genererMotDePasseTemporaire() {
  // Lisible à l'oral/à la main (pas de 0/O/1/l ambigus), assez long pour être sûr.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let motDePasse = "";
  for (let i = 0; i < 10; i++) {
    motDePasse += alphabet[crypto.randomInt(alphabet.length)];
  }
  return motDePasse;
}

// Création du compte bailleur (une seule fois normalement, pour démarrer l'app)
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
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const resultat = await pool.query(
      `INSERT INTO comptes.bailleurs (nom_complet, telephone, email, mot_de_passe_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nom_complet, telephone, email, email_verifie, photo_url`,
      [nom_complet, telephone, email || null, hash]
    );
    const bailleur = resultat.rows[0];

    if (bailleur.email) {
      // On ne bloque jamais l'inscription si l'envoi d'email échoue —
      // le compte reste utilisable par téléphone + mot de passe dans tous les cas.
      envoyerJetonVerification(bailleur).catch((err) =>
        console.error("Échec envoi email de vérification :", err.message)
      );
    }

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

// Génère un jeton de vérification, le sauvegarde (haché) et envoie l'email.
async function envoyerJetonVerification(bailleur) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(token, 10);
  const expire = new Date(Date.now() + DUREE_TOKEN_VERIFICATION_MS);

  await pool.query(
    `UPDATE comptes.bailleurs
     SET verification_token_hash = $1, verification_token_expire = $2
     WHERE id = $3`,
    [tokenHash, expire, bailleur.id]
  );

  await envoyerEmailVerification({
    email: bailleur.email,
    bailleurId: bailleur.id,
    nomComplet: bailleur.nom_complet,
    token,
  });
}

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

// Vérification d'email : lien cliqué depuis l'email reçu à l'inscription.
router.post("/verifier-email", async (req, res) => {
  const { id, token } = req.body;
  if (!id || !token) {
    return res.status(400).json({ ok: false, error: "Lien de vérification invalide." });
  }

  try {
    const r = await pool.query(
      `SELECT id, verification_token_hash, verification_token_expire, email_verifie
       FROM comptes.bailleurs WHERE id = $1`,
      [id]
    );
    const bailleur = r.rows[0];
    if (!bailleur || !bailleur.verification_token_hash) {
      return res.status(400).json({ ok: false, error: "Lien de vérification invalide ou déjà utilisé." });
    }
    if (bailleur.email_verifie) {
      return res.json({ ok: true, deja_verifie: true });
    }
    if (new Date(bailleur.verification_token_expire) < new Date()) {
      return res.status(400).json({
        ok: false,
        error: "Ce lien a expiré. Reconnecte-toi puis demande un nouvel email de vérification.",
      });
    }
    const valide = await bcrypt.compare(token, bailleur.verification_token_hash);
    if (!valide) {
      return res.status(400).json({ ok: false, error: "Lien de vérification invalide ou déjà utilisé." });
    }

    await pool.query(
      `UPDATE comptes.bailleurs
       SET email_verifie = true, verification_token_hash = NULL, verification_token_expire = NULL
       WHERE id = $1`,
      [id]
    );
    res.json({ ok: true, deja_verifie: false });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Renvoyer l'email de vérification (bailleur déjà connecté, ex. premier email perdu).
router.post("/renvoyer-verification", authentifier, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, nom_complet, email, email_verifie FROM comptes.bailleurs WHERE id = $1`,
      [req.bailleurId]
    );
    const bailleur = r.rows[0];
    if (!bailleur || !bailleur.email) {
      return res.status(400).json({ ok: false, error: "Aucun email enregistré sur ce compte." });
    }
    if (bailleur.email_verifie) {
      return res.json({ ok: true, deja_verifie: true });
    }
    await envoyerJetonVerification(bailleur);
    res.json({ ok: true, deja_verifie: false });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Mot de passe oublié : envoie un nouveau mot de passe temporaire par email.
// Ne révèle jamais si l'email existe ou non côté réponse (message générique),
// pour éviter qu'on devine quels emails sont enregistrés.
router.post("/mot-de-passe-oublie", async (req, res) => {
  const { email } = req.body;
  const messageGenerique = {
    ok: true,
    message:
      "Si un compte vérifié correspond à cet email, un nouveau mot de passe vient d'y être envoyé.",
  };

  if (!email || !email.trim()) {
    return res.status(400).json({ ok: false, error: "Email requis." });
  }

  try {
    const r = await pool.query(
      `SELECT id, nom_complet, email, email_verifie, reinitialisation_demandee_le
       FROM comptes.bailleurs WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );
    const bailleur = r.rows[0];

    // Compte introuvable, ou email pas encore vérifié : on répond quand même
    // avec le message générique (rien à faire de plus côté serveur).
    if (!bailleur || !bailleur.email_verifie) {
      return res.json(messageGenerique);
    }

    if (
      bailleur.reinitialisation_demandee_le &&
      Date.now() - new Date(bailleur.reinitialisation_demandee_le).getTime() < DELAI_MIN_ENTRE_DEMANDES_MS
    ) {
      return res.json(messageGenerique);
    }

    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);
    await pool.query(
      `UPDATE comptes.bailleurs
       SET mot_de_passe_hash = $1, reinitialisation_demandee_le = NOW()
       WHERE id = $2`,
      [hash, bailleur.id]
    );

    await envoyerMotDePasseTemporaire({
      email: bailleur.email,
      nomComplet: bailleur.nom_complet,
      motDePasseTemporaire,
    });

    res.json(messageGenerique);
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
