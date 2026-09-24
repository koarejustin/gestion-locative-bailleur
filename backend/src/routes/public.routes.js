const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { validerCnib } = require("../services/validation");
const { envoyerCodeVerificationCandidature, envoyerConfirmationSignature } = require("../services/email");
const { genererJetonLocataire } = require("../services/jetons");

const router = express.Router();

// --- Routes publiques : aucune connexion requise. Un prospect consulte les ---
// unités libres, candidate, confirme son email (code à usage unique — pas de
// SMS payant pour l'instant), puis signe électroniquement : ça crée
// directement son compte locataire + son contrat, exactement comme si le
// bailleur l'avait fait à la main.

const DUREE_CODE_VERIFICATION_MS = 15 * 60 * 1000; // 15 min
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Vitrine : unités libres, avec filtres optionnels ---

router.get("/biens-disponibles", async (req, res) => {
  const { usage, quartier_id, type_bien } = req.query;
  try {
    const r = await pool.query(
      `SELECT
         c.id AS chambre_id, c.numero_porte, c.prix_mensuel, c.description,
         m.id AS maison_id, m.nom AS maison_nom, m.type_bien, m.disposition,
         m.usage_bien, m.style_construction, m.nombre_etages, m.adresse_precise,
         q.id AS quartier_id, q.nom AS quartier_nom
       FROM biens.chambres c
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE c.statut = 'libre'
         AND ($1::varchar IS NULL OR m.usage_bien = $1)
         AND ($2::int IS NULL OR q.id = $2)
         AND ($3::varchar IS NULL OR m.type_bien = $3)
       ORDER BY q.nom, m.nom, c.numero_porte`,
      [usage || null, quartier_id || null, type_bien || null]
    );

    const unites = r.rows.map((row) => ({
      chambre: {
        id: row.chambre_id,
        numero_porte: row.numero_porte,
        prix_mensuel: Number(row.prix_mensuel),
        description: row.description,
      },
      maison: {
        id: row.maison_id,
        nom: row.maison_nom,
        type_bien: row.type_bien,
        disposition: row.disposition,
        usage_bien: row.usage_bien,
        style_construction: row.style_construction,
        nombre_etages: row.nombre_etages,
        adresse_precise: row.adresse_precise,
      },
      quartier: { id: row.quartier_id, nom: row.quartier_nom },
      photos: [],
    }));

    if (unites.length > 0) {
      const idsChambres = unites.map((u) => u.chambre.id);
      const idsMaisons = [...new Set(unites.map((u) => u.maison.id))];

      const rPhotosChambre = await pool.query(
        `SELECT chambre_id, id, url FROM biens.photos_chambre
         WHERE chambre_id = ANY($1::int[]) ORDER BY chambre_id, ordre, id`,
        [idsChambres]
      );
      const rPhotosMaison = await pool.query(
        `SELECT maison_id, id, url FROM biens.photos_maison
         WHERE maison_id = ANY($1::int[]) ORDER BY maison_id, ordre, id`,
        [idsMaisons]
      );

      for (const unite of unites) {
        const photosChambre = rPhotosChambre.rows
          .filter((p) => p.chambre_id === unite.chambre.id)
          .map((p) => ({ id: p.id, url: p.url }));
        const photosMaison = rPhotosMaison.rows
          .filter((p) => p.maison_id === unite.maison.id)
          .map((p) => ({ id: p.id, url: p.url }));
        unite.photos = [...photosChambre, ...photosMaison];
      }
    }

    res.json({ ok: true, unites });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Détail d'une unité (à condition qu'elle soit toujours libre) ---

async function trouverUniteLibre(chambreId) {
  const r = await pool.query(
    `SELECT
       c.id AS chambre_id, c.numero_porte, c.prix_mensuel, c.description, c.statut,
       m.id AS maison_id, m.bailleur_id, m.nom AS maison_nom, m.type_bien, m.disposition,
       m.usage_bien, m.style_construction, m.nombre_etages, m.adresse_precise,
       q.id AS quartier_id, q.nom AS quartier_nom
     FROM biens.chambres c
     JOIN biens.maisons_cours m ON m.id = c.maison_id
     JOIN biens.quartiers q ON q.id = m.quartier_id
     WHERE c.id = $1`,
    [chambreId]
  );
  return r.rows[0] || null;
}

router.get("/chambres/:id", async (req, res) => {
  const unite = await trouverUniteLibre(req.params.id);
  if (!unite || unite.statut !== "libre") {
    return res.status(404).json({ ok: false, error: "Cette unité n'est plus disponible." });
  }

  const rPhotosChambre = await pool.query(
    `SELECT id, url FROM biens.photos_chambre WHERE chambre_id = $1 ORDER BY ordre, id`,
    [unite.chambre_id]
  );
  const rPhotosMaison = await pool.query(
    `SELECT id, url FROM biens.photos_maison WHERE maison_id = $1 ORDER BY ordre, id`,
    [unite.maison_id]
  );

  res.json({
    ok: true,
    unite: {
      chambre: {
        id: unite.chambre_id,
        numero_porte: unite.numero_porte,
        prix_mensuel: Number(unite.prix_mensuel),
        description: unite.description,
      },
      maison: {
        id: unite.maison_id,
        nom: unite.maison_nom,
        type_bien: unite.type_bien,
        disposition: unite.disposition,
        usage_bien: unite.usage_bien,
        style_construction: unite.style_construction,
        nombre_etages: unite.nombre_etages,
        adresse_precise: unite.adresse_precise,
      },
      quartier: { id: unite.quartier_id, nom: unite.quartier_nom },
      photos: [...rPhotosChambre.rows, ...rPhotosMaison.rows],
    },
  });
});

// --- Candidature : étape 1 — identité + email à confirmer ---

function genererCode() {
  return String(crypto.randomInt(100000, 999999));
}

router.post("/candidatures", async (req, res) => {
  const { chambre_id, nom_complet, telephone, email, piece_identite_num, date_debut_souhaitee } = req.body;

  if (!chambre_id || !nom_complet?.trim() || !telephone?.trim() || !email?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Unité, nom complet, téléphone et email sont obligatoires.",
    });
  }
  if (!REGEX_EMAIL.test(email.trim())) {
    return res.status(400).json({ ok: false, error: "Adresse email invalide." });
  }
  const cnib = validerCnib(piece_identite_num);
  if (cnib.erreur) return res.status(400).json({ ok: false, error: cnib.erreur });

  const unite = await trouverUniteLibre(chambre_id);
  if (!unite || unite.statut !== "libre") {
    return res.status(409).json({ ok: false, error: "Cette unité n'est plus disponible." });
  }

  try {
    const code = genererCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expire = new Date(Date.now() + DUREE_CODE_VERIFICATION_MS);
    // Caution par défaut : un mois de loyer (règle la plus courante) — le
    // bailleur peut toujours l'ajuster ensuite comme pour un contrat manuel.
    const cautionMontant = Number(unite.prix_mensuel);

    const r = await pool.query(
      `INSERT INTO location.candidatures
         (chambre_id, nom_complet, telephone, email, piece_identite_num,
          loyer_mensuel, caution_montant, date_debut_souhaitee,
          code_verification_hash, code_verification_expire)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        chambre_id,
        nom_complet.trim(),
        telephone.trim(),
        email.trim(),
        cnib.valeur,
        unite.prix_mensuel,
        cautionMontant,
        date_debut_souhaitee || null,
        codeHash,
        expire,
      ]
    );

    await envoyerCodeVerificationCandidature({ email: email.trim(), nomComplet: nom_complet.trim(), code });

    res.status(201).json({ ok: true, candidature_id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function trouverCandidature(id) {
  const r = await pool.query(
    `SELECT ca.*, c.statut AS chambre_statut
     FROM location.candidatures ca
     JOIN biens.chambres c ON c.id = ca.chambre_id
     WHERE ca.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

// Renvoyer le code (email non reçu, faute de frappe...) — régénère un
// nouveau code tant que la candidature n'est pas déjà signée.
router.post("/candidatures/:id/renvoyer-code", async (req, res) => {
  const candidature = await trouverCandidature(req.params.id);
  if (!candidature) return res.status(404).json({ ok: false, error: "Candidature introuvable." });
  if (candidature.statut === "signee") {
    return res.status(409).json({ ok: false, error: "Cette candidature a déjà été signée." });
  }

  try {
    const code = genererCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expire = new Date(Date.now() + DUREE_CODE_VERIFICATION_MS);

    await pool.query(
      `UPDATE location.candidatures
       SET code_verification_hash = $1, code_verification_expire = $2, statut = 'email_a_verifier'
       WHERE id = $3`,
      [codeHash, expire, req.params.id]
    );

    await envoyerCodeVerificationCandidature({
      email: candidature.email,
      nomComplet: candidature.nom_complet,
      code,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Candidature : étape 2 — confirmation du code reçu par email ---

router.post("/candidatures/:id/verifier", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ ok: false, error: "Code requis." });

  const candidature = await trouverCandidature(req.params.id);
  if (!candidature) return res.status(404).json({ ok: false, error: "Candidature introuvable." });
  if (candidature.statut === "signee") {
    return res.status(409).json({ ok: false, error: "Cette candidature a déjà été signée." });
  }
  if (!candidature.code_verification_hash || new Date(candidature.code_verification_expire) < new Date()) {
    return res.status(400).json({
      ok: false,
      error: "Ce code a expiré. Demande-en un nouveau.",
    });
  }
  const valide = await bcrypt.compare(String(code), candidature.code_verification_hash);
  if (!valide) {
    return res.status(400).json({ ok: false, error: "Code incorrect." });
  }
  if (candidature.chambre_statut !== "libre") {
    return res.status(409).json({ ok: false, error: "Cette unité n'est plus disponible." });
  }

  try {
    await pool.query(
      `UPDATE location.candidatures
       SET statut = 'email_verifie', email_verifie_le = now()
       WHERE id = $1`,
      [req.params.id]
    );

    const unite = await trouverUniteLibre(candidature.chambre_id);
    res.json({
      ok: true,
      recap: {
        maison_nom: unite.maison_nom,
        numero_porte: unite.numero_porte,
        quartier_nom: unite.quartier_nom,
        loyer_mensuel: Number(candidature.loyer_mensuel),
        caution_montant: Number(candidature.caution_montant),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Candidature : étape 3 — signature électronique ---
// Preuve = email confirmé + nom tapé + case d'acceptation + horodatage + IP.
// Crée directement le compte locataire (actif) et le contrat, comme si le
// bailleur l'avait fait à la main. Pas de vérification d'identité par SMS
// pour l'instant (payant, pas encore activé).

router.post("/candidatures/:id/signer", async (req, res) => {
  const { mot_de_passe, confirmation_mot_de_passe, nom_signature, accepte_conditions } = req.body;

  if (!nom_signature?.trim()) {
    return res.status(400).json({ ok: false, error: "Merci de taper ton nom complet pour signer." });
  }
  if (accepte_conditions !== true) {
    return res.status(400).json({ ok: false, error: "Merci d'accepter les conditions du contrat pour signer." });
  }
  if (!mot_de_passe || mot_de_passe.length < 6) {
    return res.status(400).json({ ok: false, error: "Le mot de passe doit faire au moins 6 caractères." });
  }
  if (mot_de_passe !== confirmation_mot_de_passe) {
    return res.status(400).json({ ok: false, error: "Les deux mots de passe ne correspondent pas." });
  }

  const candidature = await trouverCandidature(req.params.id);
  if (!candidature) return res.status(404).json({ ok: false, error: "Candidature introuvable." });
  if (candidature.statut === "signee") {
    return res.status(409).json({ ok: false, error: "Cette candidature a déjà été signée." });
  }
  if (candidature.statut !== "email_verifie") {
    return res.status(409).json({ ok: false, error: "Merci de d'abord confirmer ton email." });
  }

  const unite = await trouverUniteLibre(candidature.chambre_id);
  if (!unite || unite.statut !== "libre") {
    return res.status(409).json({
      ok: false,
      error: "Cette unité vient d'être prise par quelqu'un d'autre — choisis-en une autre.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const motDePasseHash = await bcrypt.hash(mot_de_passe, 10);
    const rLocataire = await client.query(
      `INSERT INTO location.locataires
         (bailleur_id, nom_complet, telephone, piece_identite_num, mot_de_passe_hash, compte_actif, origine)
       VALUES ($1, $2, $3, $4, $5, true, 'candidature_en_ligne')
       RETURNING id, nom_complet, telephone`,
      [unite.bailleur_id, candidature.nom_complet, candidature.telephone, candidature.piece_identite_num, motDePasseHash]
    );
    const locataire = rLocataire.rows[0];

    const dateDebut = candidature.date_debut_souhaitee || new Date().toISOString().slice(0, 10);
    const rContrat = await client.query(
      `INSERT INTO location.contrats (chambre_id, locataire_id, loyer_mensuel, caution_montant, date_debut)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [candidature.chambre_id, locataire.id, candidature.loyer_mensuel, candidature.caution_montant, dateDebut]
    );
    const contratId = rContrat.rows[0].id;

    await client.query(`UPDATE biens.chambres SET statut = 'occupee' WHERE id = $1`, [candidature.chambre_id]);

    await client.query(
      `UPDATE location.candidatures
       SET statut = 'signee', signature_nom_saisi = $1, signature_ip = $2, signature_user_agent = $3,
           signee_le = now(), locataire_id = $4, contrat_id = $5
       WHERE id = $6`,
      [nom_signature.trim(), req.ip || null, req.get("user-agent") || null, locataire.id, contratId, req.params.id]
    );

    await client.query("COMMIT");

    envoyerConfirmationSignature({
      email: candidature.email,
      nomComplet: candidature.nom_complet,
      logement: `${unite.maison_nom} — Porte ${unite.numero_porte} (${unite.quartier_nom})`,
      loyerMensuel: Number(candidature.loyer_mensuel),
      cautionMontant: Number(candidature.caution_montant),
    }).catch((err) => console.error("Échec envoi email de confirmation de signature :", err.message));

    res.status(201).json({
      ok: true,
      jeton: genererJetonLocataire(locataire),
      locataire,
      contrat_id: contratId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Cette unité vient d'être prise — choisis-en une autre." });
    }
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
