const express = require("express");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { premierJourDuMois, obtenirOuCreerEcheance } = require("../services/echeances");
const { upload, dossierUploads } = require("../middleware/upload");

const router = express.Router();

const METHODES_VALIDES = ["orange_money", "moov_money", "wave", "especes"];

// --- Espace locataire (lecture seule) ---
// Toutes les routes ici sont protégées par authentifierLocataire (voir server.js)
// et ne renvoient jamais que les données du locataire connecté (req.locataireId) :
// pas de paramètre d'id dans l'URL, donc pas de risque de consulter le contrat
// d'un autre locataire en changeant un id dans la requête.

async function trouverLocataire(locataireId) {
  const r = await pool.query(
    `SELECT id, nom_complet, telephone, photo_url FROM location.locataires WHERE id = $1`,
    [locataireId]
  );
  return r.rows[0] || null;
}

// Le contrat le plus pertinent pour ce locataire : l'actif en priorité, sinon
// le plus récent (locataire parti — utile pour consulter l'historique et la
// caution après son départ).
async function trouverContratDuLocataire(locataireId) {
  const r = await pool.query(
    `SELECT ct.id, ct.loyer_mensuel, ct.jour_echeance, ct.marge_tolerance_jours,
            ct.caution_montant, ct.caution_statut, ct.date_debut, ct.date_fin, ct.actif,
            c.id AS chambre_id, c.numero_porte,
            m.nom AS maison_nom, m.type_bien AS maison_type, m.adresse_precise,
            q.nom AS quartier_nom,
            b.nom_complet AS bailleur_nom, b.telephone AS bailleur_telephone
     FROM location.contrats ct
     JOIN biens.chambres c ON c.id = ct.chambre_id
     JOIN biens.maisons_cours m ON m.id = c.maison_id
     JOIN biens.quartiers q ON q.id = m.quartier_id
     JOIN location.locataires l ON l.id = ct.locataire_id
     JOIN comptes.bailleurs b ON b.id = l.bailleur_id
     WHERE ct.locataire_id = $1
     ORDER BY ct.actif DESC, ct.date_debut DESC
     LIMIT 1`,
    [locataireId]
  );
  const contrat = r.rows[0];
  if (!contrat) return null;

  let photoUrl = null;
  const rPhotoChambre = await pool.query(
    `SELECT url FROM biens.photos_chambre WHERE chambre_id = $1 ORDER BY ordre LIMIT 1`,
    [contrat.chambre_id]
  );
  photoUrl = rPhotoChambre.rows[0]?.url || null;
  if (!photoUrl) {
    const rPhotoMaison = await pool.query(
      `SELECT pm.url FROM biens.photos_maison pm
       JOIN biens.chambres c ON c.maison_id = pm.maison_id
       WHERE c.id = $1 ORDER BY pm.ordre LIMIT 1`,
      [contrat.chambre_id]
    );
    photoUrl = rPhotoMaison.rows[0]?.url || null;
  }

  return {
    id: contrat.id,
    loyer_mensuel: Number(contrat.loyer_mensuel),
    jour_echeance: contrat.jour_echeance,
    marge_tolerance_jours: contrat.marge_tolerance_jours,
    caution_montant: Number(contrat.caution_montant),
    caution_statut: contrat.caution_statut,
    date_debut: contrat.date_debut,
    date_fin: contrat.date_fin,
    actif: contrat.actif,
    photo_url: photoUrl,
    chambre: { id: contrat.chambre_id, numero_porte: contrat.numero_porte },
    maison: { nom: contrat.maison_nom, type: contrat.maison_type, adresse: contrat.adresse_precise },
    quartier: contrat.quartier_nom,
    bailleur: { nom_complet: contrat.bailleur_nom, telephone: contrat.bailleur_telephone },
  };
}

// --- Contrat en cours (logement, caution, situation du mois) ---

router.get("/mon-contrat", async (req, res) => {
  try {
    const locataire = await trouverLocataire(req.locataireId);
    if (!locataire) return res.status(404).json({ ok: false, error: "Compte introuvable." });

    const contrat = await trouverContratDuLocataire(req.locataireId);

    let situationMois = null;
    if (contrat && contrat.actif) {
      const moisISO = premierJourDuMois();
      const echeance = await obtenirOuCreerEcheance(
        {
          id: contrat.id,
          loyer_mensuel: contrat.loyer_mensuel,
          jour_echeance: contrat.jour_echeance,
          marge_tolerance_jours: contrat.marge_tolerance_jours,
        },
        moisISO
      );
      situationMois = {
        mois: echeance.mois,
        montant_du: echeance.montant_du,
        montant_verse: echeance.montant_verse,
        reste: Math.max(0, echeance.montant_du - echeance.montant_verse),
        statut: echeance.statut,
      };
    }

    res.json({ ok: true, locataire, contrat, situation_mois: situationMois });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Historique complet (toutes les échéances + tous les versements) ---

router.get("/mon-historique", async (req, res) => {
  try {
    const contrat = await trouverContratDuLocataire(req.locataireId);
    if (!contrat) return res.json({ ok: true, echeances: [], versements: [] });

    const rEcheances = await pool.query(
      `SELECT id, mois, montant_du, montant_verse, statut
       FROM paiements.echeances WHERE contrat_id = $1 ORDER BY mois DESC`,
      [contrat.id]
    );
    const rVersements = await pool.query(
      `SELECT v.id, v.montant, v.methode, v.reference_transaction, v.verse_le, v.recu_pdf_url,
              v.statut_versement, v.numero_expediteur
       FROM paiements.versements v
       JOIN paiements.echeances e ON e.id = v.echeance_id
       WHERE e.contrat_id = $1
       ORDER BY v.verse_le DESC`,
      [contrat.id]
    );

    res.json({
      ok: true,
      echeances: rEcheances.rows.map((e) => ({
        ...e,
        montant_du: Number(e.montant_du),
        montant_verse: Number(e.montant_verse),
      })),
      versements: rVersements.rows.map((v) => ({ ...v, montant: Number(v.montant) })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Déclarer un paiement envoyé depuis son propre numéro Mobile Money ---
// Le montant ne compte pas encore dans le solde de l'échéance, et aucun reçu
// n'est généré tant que le bailleur n'a pas confirmé avoir bien reçu la somme
// sur son propre compte (Orange Money / Moov Money / Wave) — l'application
// n'a pas encore d'accès API direct chez ces opérateurs pour vérifier ça
// elle-même automatiquement.

router.post("/declarer-paiement", async (req, res) => {
  const { montant, methode, reference_transaction, numero_expediteur, mois } = req.body;

  if (!montant || Number(montant) <= 0) {
    return res.status(400).json({ ok: false, error: "Montant (positif) obligatoire." });
  }
  if (!METHODES_VALIDES.includes(methode)) {
    return res.status(400).json({ ok: false, error: "Moyen de paiement invalide." });
  }

  const contrat = await trouverContratDuLocataire(req.locataireId);
  if (!contrat) return res.status(404).json({ ok: false, error: "Aucun contrat associé à ton compte." });
  if (!contrat.actif) {
    return res.status(409).json({ ok: false, error: "Ton contrat est terminé — impossible de déclarer un paiement." });
  }

  try {
    const moisISO = mois || premierJourDuMois();
    const echeance = await obtenirOuCreerEcheance(
      { id: contrat.id, loyer_mensuel: contrat.loyer_mensuel, jour_echeance: contrat.jour_echeance, marge_tolerance_jours: contrat.marge_tolerance_jours },
      moisISO
    );

    const r = await pool.query(
      `INSERT INTO paiements.versements
         (echeance_id, montant, methode, reference_transaction, numero_expediteur, initiee_par, statut_versement)
       VALUES ($1, $2, $3, $4, $5, 'locataire', 'en_attente_confirmation')
       RETURNING id, montant, methode, reference_transaction, numero_expediteur, verse_le, statut_versement`,
      [echeance.id, montant, methode, reference_transaction || null, numero_expediteur || null]
    );

    const versement = r.rows[0];
    versement.montant = Number(versement.montant);
    res.status(201).json({ ok: true, versement });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Photo de profil du locataire (remplace l'icône générique côté bailleur) ---

router.post("/ma-photo", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "Aucune photo reçue." });
  }
  try {
    const ancien = await pool.query(
      `SELECT photo_url FROM location.locataires WHERE id = $1`,
      [req.locataireId]
    );
    const url = `/uploads/${req.file.filename}`;
    await pool.query(`UPDATE location.locataires SET photo_url = $1 WHERE id = $2`, [
      url,
      req.locataireId,
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

router.delete("/ma-photo", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT photo_url FROM location.locataires WHERE id = $1`,
      [req.locataireId]
    );
    const url = r.rows[0]?.photo_url;
    if (!url) return res.json({ ok: true });

    await pool.query(`UPDATE location.locataires SET photo_url = NULL WHERE id = $1`, [
      req.locataireId,
    ]);
    fs.unlink(path.join(dossierUploads, path.basename(url)), () => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
