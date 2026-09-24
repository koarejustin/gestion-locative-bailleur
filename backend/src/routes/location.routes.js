const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { premierJourDuMois, obtenirOuCreerEcheance } = require("../services/echeances");
const { validerCnib } = require("../services/validation");

const router = express.Router();

// --- Aides : vérifier qu'une ressource appartient bien au bailleur connecté ---

async function trouverLocataire(bailleurId, locataireId) {
  const r = await pool.query(
    `SELECT id, compte_actif FROM location.locataires WHERE id = $1 AND bailleur_id = $2`,
    [locataireId, bailleurId]
  );
  return r.rows[0] || null;
}

async function trouverContrat(bailleurId, contratId) {
  const r = await pool.query(
    `SELECT ct.id, ct.chambre_id, ct.actif
     FROM location.contrats ct
     JOIN location.locataires l ON l.id = ct.locataire_id
     WHERE ct.id = $1 AND l.bailleur_id = $2`,
    [contratId, bailleurId]
  );
  return r.rows[0] || null;
}

async function trouverChambreDuBailleur(bailleurId, chambreId) {
  const r = await pool.query(
    `SELECT c.id FROM biens.chambres c
     JOIN biens.maisons_cours m ON m.id = c.maison_id
     JOIN biens.quartiers q ON q.id = m.quartier_id
     WHERE c.id = $1 AND q.bailleur_id = $2`,
    [chambreId, bailleurId]
  );
  return r.rows[0] || null;
}

// --- Chambres disponibles (pour créer un contrat) ---

router.get("/chambres-disponibles", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.numero_porte, c.prix_mensuel, m.nom AS maison_nom, q.nom AS quartier_nom
       FROM biens.chambres c
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE q.bailleur_id = $1 AND c.statut = 'libre'
       ORDER BY q.nom, m.nom, c.numero_porte`,
      [req.bailleurId]
    );
    res.json({
      ok: true,
      chambres: r.rows.map((c) => ({ ...c, prix_mensuel: Number(c.prix_mensuel) })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Locataires : liste avec leur contrat actif (si existant) ---

router.get("/locataires", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         l.id, l.nom_complet, l.telephone, l.piece_identite_num, l.compte_actif, l.origine, l.photo_url,
         ct.id AS contrat_id, ct.loyer_mensuel, ct.jour_echeance, ct.marge_tolerance_jours,
         ct.caution_montant, ct.caution_statut, ct.date_debut, ct.date_fin, ct.actif AS contrat_actif,
         c.id AS chambre_id, c.numero_porte,
         m.nom AS maison_nom, m.type_bien AS maison_type, q.nom AS quartier_nom,
         photo.url AS maison_photo_url
       FROM location.locataires l
       LEFT JOIN location.contrats ct ON ct.locataire_id = l.id AND ct.actif = true
       LEFT JOIN biens.chambres c ON c.id = ct.chambre_id
       LEFT JOIN biens.maisons_cours m ON m.id = c.maison_id
       LEFT JOIN biens.quartiers q ON q.id = m.quartier_id
       LEFT JOIN LATERAL (
         SELECT pm.url FROM biens.photos_maison pm
         WHERE pm.maison_id = m.id
         ORDER BY pm.ordre, pm.id
         LIMIT 1
       ) photo ON true
       WHERE l.bailleur_id = $1
       ORDER BY l.nom_complet`,
      [req.bailleurId]
    );

    const moisISO = premierJourDuMois();
    const locataires = [];
    for (const row of r.rows) {
      let contrat = null;
      if (row.contrat_id) {
        // Statut du paiement du mois en cours (créé à la volée si besoin).
        const echeance = await obtenirOuCreerEcheance(
          { id: row.contrat_id, loyer_mensuel: Number(row.loyer_mensuel), jour_echeance: row.jour_echeance, marge_tolerance_jours: row.marge_tolerance_jours },
          moisISO
        );
        contrat = {
          id: row.contrat_id,
          loyer_mensuel: Number(row.loyer_mensuel),
          jour_echeance: row.jour_echeance,
          caution_montant: Number(row.caution_montant),
          caution_statut: row.caution_statut,
          date_debut: row.date_debut,
          date_fin: row.date_fin,
          statut_paiement_mois: echeance.statut,
          reste_a_payer_mois: Math.max(0, echeance.montant_du - echeance.montant_verse),
          chambre: {
            id: row.chambre_id,
            numero_porte: row.numero_porte,
            maison_nom: row.maison_nom,
            maison_type: row.maison_type,
            quartier_nom: row.quartier_nom,
            maison_photo_url: row.maison_photo_url,
          },
        };
      }
      locataires.push({
        id: row.id,
        nom_complet: row.nom_complet,
        telephone: row.telephone,
        piece_identite_num: row.piece_identite_num,
        compte_actif: row.compte_actif,
        origine: row.origine,
        photo_url: row.photo_url,
        contrat,
      });
    }

    res.json({ ok: true, locataires });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/locataires", async (req, res) => {
  const { nom_complet, telephone, piece_identite_num } = req.body;
  if (!nom_complet || !nom_complet.trim() || !telephone || !telephone.trim()) {
    return res.status(400).json({ ok: false, error: "Nom complet et téléphone sont obligatoires." });
  }
  const cnib = validerCnib(piece_identite_num);
  if (cnib.erreur) return res.status(400).json({ ok: false, error: cnib.erreur });

  try {
    const r = await pool.query(
      `INSERT INTO location.locataires (bailleur_id, nom_complet, telephone, piece_identite_num)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nom_complet, telephone, piece_identite_num, compte_actif`,
      [req.bailleurId, nom_complet.trim(), telephone.trim(), cnib.valeur]
    );
    res.status(201).json({ ok: true, locataire: { ...r.rows[0], contrat: null } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/locataires/:id", async (req, res) => {
  const { nom_complet, telephone, piece_identite_num } = req.body;
  if (!nom_complet || !nom_complet.trim() || !telephone || !telephone.trim()) {
    return res.status(400).json({ ok: false, error: "Nom complet et téléphone sont obligatoires." });
  }
  const cnib = validerCnib(piece_identite_num);
  if (cnib.erreur) return res.status(400).json({ ok: false, error: cnib.erreur });

  const existe = await trouverLocataire(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Locataire introuvable." });

  try {
    const r = await pool.query(
      `UPDATE location.locataires SET nom_complet = $1, telephone = $2, piece_identite_num = $3
       WHERE id = $4 RETURNING id, nom_complet, telephone, piece_identite_num, compte_actif`,
      [nom_complet.trim(), telephone.trim(), cnib.valeur, req.params.id]
    );
    res.json({ ok: true, locataire: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/locataires/:id", async (req, res) => {
  const existe = await trouverLocataire(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Locataire introuvable." });

  try {
    await pool.query(`DELETE FROM location.locataires WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        ok: false,
        error: "Ce locataire a un contrat enregistré — termine ou supprime d'abord le contrat.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Code d'accès : le bailleur génère un code à 6 chiffres que le locataire
// utilise (avec son téléphone) pour activer son compte et choisir son mot de passe ---

router.post("/locataires/:id/code-acces", async (req, res) => {
  const locataire = await trouverLocataire(req.bailleurId, req.params.id);
  if (!locataire) return res.status(404).json({ ok: false, error: "Locataire introuvable." });

  try {
    const code = String(crypto.randomInt(100000, 999999));
    const hash = await bcrypt.hash(code, 10);
    const expire = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // valable 7 jours

    await pool.query(
      `UPDATE location.locataires
       SET code_acces_hash = $1, code_acces_expire = $2
       WHERE id = $3`,
      [hash, expire, req.params.id]
    );

    // Le code n'est renvoyé qu'ici, en clair, une seule fois — à transmettre
    // au locataire (SMS, oralement...). Il n'est jamais stocké en clair.
    res.json({ ok: true, code, expire });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Contrats ---

router.post("/contrats", async (req, res) => {
  const {
    chambre_id,
    locataire_id,
    loyer_mensuel,
    jour_echeance,
    marge_tolerance_jours,
    caution_montant,
    date_debut,
  } = req.body;

  if (!chambre_id || !locataire_id || loyer_mensuel === undefined || !date_debut) {
    return res.status(400).json({
      ok: false,
      error: "Chambre, locataire, loyer mensuel et date de début sont obligatoires.",
    });
  }

  const chambre = await trouverChambreDuBailleur(req.bailleurId, chambre_id);
  if (!chambre) return res.status(404).json({ ok: false, error: "Chambre introuvable." });
  const locataire = await trouverLocataire(req.bailleurId, locataire_id);
  if (!locataire) return res.status(404).json({ ok: false, error: "Locataire introuvable." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO location.contrats
         (chambre_id, locataire_id, loyer_mensuel, jour_echeance, marge_tolerance_jours, caution_montant, date_debut)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, chambre_id, locataire_id, loyer_mensuel, jour_echeance, marge_tolerance_jours,
                 caution_montant, date_debut, date_fin, actif`,
      [
        chambre_id,
        locataire_id,
        loyer_mensuel,
        jour_echeance || 5,
        marge_tolerance_jours ?? 3,
        caution_montant || 0,
        date_debut,
      ]
    );
    await client.query(`UPDATE biens.chambres SET statut = 'occupee' WHERE id = $1`, [chambre_id]);
    await client.query("COMMIT");

    const contrat = r.rows[0];
    contrat.loyer_mensuel = Number(contrat.loyer_mensuel);
    contrat.caution_montant = Number(contrat.caution_montant);
    res.status(201).json({ ok: true, contrat });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Cette chambre a déjà un contrat actif.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// Terminer un contrat : le marque inactif, fixe la date de fin, et libère la chambre
router.put("/contrats/:id/terminer", async (req, res) => {
  const contrat = await trouverContrat(req.bailleurId, req.params.id);
  if (!contrat) return res.status(404).json({ ok: false, error: "Contrat introuvable." });
  if (!contrat.actif) {
    return res.status(409).json({ ok: false, error: "Ce contrat est déjà terminé." });
  }

  const { date_fin, caution_statut } = req.body;
  const CAUTION_STATUTS_VALIDES = ["detenue", "restituee_totale", "restituee_partielle", "retenue"];
  if (caution_statut && !CAUTION_STATUTS_VALIDES.includes(caution_statut)) {
    return res.status(400).json({ ok: false, error: "Statut de caution invalide." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE location.contrats
       SET actif = false, date_fin = $1, caution_statut = COALESCE($2, caution_statut)
       WHERE id = $3`,
      [date_fin || new Date().toISOString().slice(0, 10), caution_statut || null, req.params.id]
    );
    await client.query(`UPDATE biens.chambres SET statut = 'libre' WHERE id = $1`, [contrat.chambre_id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
