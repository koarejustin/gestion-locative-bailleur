const express = require("express");
const pool = require("../config/db");
const { premierJourDuMois, calculerStatut, obtenirOuCreerEcheance } = require("../services/echeances");
const { genererRecuPdf } = require("../services/recus");

const router = express.Router();

const METHODES_VALIDES = ["orange_money", "moov_money", "wave", "especes"];

// Réunit toutes les infos nécessaires au reçu PDF d'un versement (avec
// vérification que ce versement appartient bien à une chambre du bailleur).
async function donneesRecu(bailleurId, versementId) {
  const r = await pool.query(
    `SELECT
       v.id, v.montant, v.methode, v.reference_transaction, v.verse_le, v.recu_pdf_url,
       e.montant_du, e.montant_verse,
       l.nom_complet AS locataire_nom, l.telephone AS locataire_telephone,
       c.numero_porte, m.nom AS maison_nom, q.nom AS quartier_nom,
       b.nom_complet AS bailleur_nom, b.telephone AS bailleur_telephone
     FROM paiements.versements v
     JOIN paiements.echeances e ON e.id = v.echeance_id
     JOIN location.contrats ct ON ct.id = e.contrat_id
     JOIN location.locataires l ON l.id = ct.locataire_id
     JOIN biens.chambres c ON c.id = ct.chambre_id
     JOIN biens.maisons_cours m ON m.id = c.maison_id
     JOIN biens.quartiers q ON q.id = m.quartier_id
     JOIN comptes.bailleurs b ON b.id = l.bailleur_id
     WHERE v.id = $1 AND l.bailleur_id = $2`,
    [versementId, bailleurId]
  );
  const row = r.rows[0];
  if (!row) return null;

  return {
    versement: {
      id: row.id,
      montant: Number(row.montant),
      methode: row.methode,
      reference_transaction: row.reference_transaction,
      verse_le: row.verse_le,
    },
    echeance: { montant_du: Number(row.montant_du), montant_verse: Number(row.montant_verse) },
    bailleur: { nom_complet: row.bailleur_nom, telephone: row.bailleur_telephone },
    locataire: { nom_complet: row.locataire_nom, telephone: row.locataire_telephone },
    chambre: { numero_porte: row.numero_porte, maison_nom: row.maison_nom, quartier_nom: row.quartier_nom },
  };
}

// Génère (ou régénère, pour refléter les versements suivants) le PDF et
// enregistre son URL sur le versement. Ne lève jamais d'exception : un souci
// de génération de reçu ne doit jamais faire échouer l'enregistrement du
// paiement lui-même.
async function genererEtEnregistrerRecu(bailleurId, versementId) {
  try {
    const donnees = await donneesRecu(bailleurId, versementId);
    if (!donnees) return null;
    const url = await genererRecuPdf(donnees);
    await pool.query(`UPDATE paiements.versements SET recu_pdf_url = $1 WHERE id = $2`, [
      url,
      versementId,
    ]);
    return url;
  } catch (err) {
    console.error(`Échec de génération du reçu pour le versement ${versementId} :`, err.message);
    return null;
  }
}

async function contratsActifsDuBailleur(bailleurId) {
  const r = await pool.query(
    `SELECT ct.id, ct.loyer_mensuel, ct.jour_echeance, ct.marge_tolerance_jours,
            l.id AS locataire_id, l.nom_complet AS locataire_nom, l.telephone AS locataire_telephone,
            c.id AS chambre_id, c.numero_porte,
            m.nom AS maison_nom, q.nom AS quartier_nom
     FROM location.contrats ct
     JOIN location.locataires l ON l.id = ct.locataire_id
     JOIN biens.chambres c ON c.id = ct.chambre_id
     JOIN biens.maisons_cours m ON m.id = c.maison_id
     JOIN biens.quartiers q ON q.id = m.quartier_id
     WHERE l.bailleur_id = $1 AND ct.actif = true
     ORDER BY q.nom, m.nom, c.numero_porte`,
    [bailleurId]
  );
  return r.rows.map((row) => ({ ...row, loyer_mensuel: Number(row.loyer_mensuel) }));
}

async function trouverContratDuBailleur(bailleurId, contratId) {
  const r = await pool.query(
    `SELECT ct.id, ct.loyer_mensuel, ct.jour_echeance, ct.marge_tolerance_jours, ct.actif
     FROM location.contrats ct
     JOIN location.locataires l ON l.id = ct.locataire_id
     WHERE ct.id = $1 AND l.bailleur_id = $2`,
    [contratId, bailleurId]
  );
  const contrat = r.rows[0];
  if (!contrat) return null;
  contrat.loyer_mensuel = Number(contrat.loyer_mensuel);
  return contrat;
}

// --- Échéances du mois : une ligne par contrat actif, avec le statut du paiement ---

router.get("/echeances", async (req, res) => {
  try {
    const moisISO = req.query.mois || premierJourDuMois();
    const contrats = await contratsActifsDuBailleur(req.bailleurId);

    const echeances = [];
    for (const contrat of contrats) {
      const echeance = await obtenirOuCreerEcheance(contrat, moisISO);
      echeances.push({
        contrat_id: contrat.id,
        locataire: {
          id: contrat.locataire_id,
          nom_complet: contrat.locataire_nom,
          telephone: contrat.locataire_telephone,
        },
        chambre: {
          id: contrat.chambre_id,
          numero_porte: contrat.numero_porte,
          maison_nom: contrat.maison_nom,
          quartier_nom: contrat.quartier_nom,
        },
        mois: echeance.mois,
        montant_du: echeance.montant_du,
        montant_verse: echeance.montant_verse,
        reste: Math.max(0, echeance.montant_du - echeance.montant_verse),
        statut: echeance.statut,
      });
    }

    res.json({ ok: true, mois: moisISO, echeances });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Résumé du mois (stats pour le tableau de bord et la page paiements) ---

router.get("/resume", async (req, res) => {
  try {
    const moisISO = req.query.mois || premierJourDuMois();
    const contrats = await contratsActifsDuBailleur(req.bailleurId);

    let totalDu = 0;
    let totalVerse = 0;
    const compteurs = { a_jour: 0, partiel: 0, en_retard: 0, en_attente: 0 };

    for (const contrat of contrats) {
      const echeance = await obtenirOuCreerEcheance(contrat, moisISO);
      totalDu += echeance.montant_du;
      totalVerse += echeance.montant_verse;
      compteurs[echeance.statut] = (compteurs[echeance.statut] || 0) + 1;
    }

    res.json({
      ok: true,
      mois: moisISO,
      total_du: totalDu,
      total_verse: totalVerse,
      nb_contrats: contrats.length,
      ...compteurs,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Enregistrer un versement (une tranche du loyer) ---

router.post("/versements", async (req, res) => {
  const { contrat_id, montant, methode, reference_transaction, mois } = req.body;

  if (!contrat_id || !montant || Number(montant) <= 0) {
    return res
      .status(400)
      .json({ ok: false, error: "Contrat et montant (positif) sont obligatoires." });
  }
  if (!METHODES_VALIDES.includes(methode)) {
    return res.status(400).json({ ok: false, error: "Moyen de paiement invalide." });
  }

  const contrat = await trouverContratDuBailleur(req.bailleurId, contrat_id);
  if (!contrat) return res.status(404).json({ ok: false, error: "Contrat introuvable." });
  if (!contrat.actif) {
    return res
      .status(409)
      .json({ ok: false, error: "Ce contrat est terminé — impossible d'y ajouter un paiement." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const moisISO = mois || premierJourDuMois();
    const echeance = await obtenirOuCreerEcheance(contrat, moisISO);

    const rVersement = await client.query(
      `INSERT INTO paiements.versements (echeance_id, montant, methode, reference_transaction)
       VALUES ($1, $2, $3, $4)
       RETURNING id, montant, methode, reference_transaction, verse_le`,
      [echeance.id, montant, methode, reference_transaction || null]
    );

    const nouveauVerse = echeance.montant_verse + Number(montant);
    const nouveauStatut = calculerStatut({
      moisISO,
      montantDu: echeance.montant_du,
      montantVerse: nouveauVerse,
      jourEcheance: contrat.jour_echeance,
      margeToleranceJours: contrat.marge_tolerance_jours,
    });

    await client.query(`UPDATE paiements.echeances SET montant_verse = $1, statut = $2 WHERE id = $3`, [
      nouveauVerse,
      nouveauStatut,
      echeance.id,
    ]);

    await client.query("COMMIT");

    const versement = rVersement.rows[0];
    versement.montant = Number(versement.montant);

    // Le reçu PDF est généré juste après (hors transaction, c'est de l'I/O
    // fichier) — le paiement est déjà bien enregistré à ce stade quoi qu'il
    // arrive à la génération du reçu.
    versement.recu_pdf_url = await genererEtEnregistrerRecu(req.bailleurId, versement.id);

    res.status(201).json({
      ok: true,
      versement,
      echeance: {
        ...echeance,
        montant_verse: nouveauVerse,
        statut: nouveauStatut,
        reste: Math.max(0, echeance.montant_du - nouveauVerse),
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// --- Historique des transactions d'un mois (pour "Encaissé ce mois") ---

router.get("/versements", async (req, res) => {
  try {
    const moisISO = req.query.mois || premierJourDuMois();
    const r = await pool.query(
      `SELECT
         v.id, v.montant, v.methode, v.reference_transaction, v.verse_le, v.recu_pdf_url,
         v.statut_versement, v.initiee_par, v.numero_expediteur,
         l.id AS locataire_id, l.nom_complet AS locataire_nom,
         c.numero_porte, m.nom AS maison_nom, q.nom AS quartier_nom
       FROM paiements.versements v
       JOIN paiements.echeances e ON e.id = v.echeance_id
       JOIN location.contrats ct ON ct.id = e.contrat_id
       JOIN location.locataires l ON l.id = ct.locataire_id
       JOIN biens.chambres c ON c.id = ct.chambre_id
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE l.bailleur_id = $1 AND e.mois = $2
       ORDER BY v.verse_le DESC`,
      [req.bailleurId, moisISO]
    );

    const versements = r.rows.map((row) => ({
      id: row.id,
      montant: Number(row.montant),
      methode: row.methode,
      reference_transaction: row.reference_transaction,
      verse_le: row.verse_le,
      recu_pdf_url: row.recu_pdf_url,
      statut_versement: row.statut_versement,
      initiee_par: row.initiee_par,
      numero_expediteur: row.numero_expediteur,
      locataire: { id: row.locataire_id, nom_complet: row.locataire_nom },
      chambre: {
        numero_porte: row.numero_porte,
        maison_nom: row.maison_nom,
        quartier_nom: row.quartier_nom,
      },
    }));

    res.json({ ok: true, mois: moisISO, versements });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Paiements déclarés par un locataire, en attente de confirmation du
// bailleur (peu importe le mois affiché sur la page Paiements) ---

router.get("/versements-en-attente", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         v.id, v.montant, v.methode, v.reference_transaction, v.verse_le, v.numero_expediteur,
         l.id AS locataire_id, l.nom_complet AS locataire_nom,
         c.numero_porte, m.nom AS maison_nom, q.nom AS quartier_nom
       FROM paiements.versements v
       JOIN paiements.echeances e ON e.id = v.echeance_id
       JOIN location.contrats ct ON ct.id = e.contrat_id
       JOIN location.locataires l ON l.id = ct.locataire_id
       JOIN biens.chambres c ON c.id = ct.chambre_id
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE l.bailleur_id = $1 AND v.statut_versement = 'en_attente_confirmation'
       ORDER BY v.verse_le ASC`,
      [req.bailleurId]
    );

    const versements = r.rows.map((row) => ({
      id: row.id,
      montant: Number(row.montant),
      methode: row.methode,
      reference_transaction: row.reference_transaction,
      numero_expediteur: row.numero_expediteur,
      verse_le: row.verse_le,
      locataire: { id: row.locataire_id, nom_complet: row.locataire_nom },
      chambre: {
        numero_porte: row.numero_porte,
        maison_nom: row.maison_nom,
        quartier_nom: row.quartier_nom,
      },
    }));

    res.json({ ok: true, versements });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function trouverVersementEnAttenteDuBailleur(bailleurId, versementId) {
  const r = await pool.query(
    `SELECT v.id, v.montant, v.echeance_id, v.statut_versement,
            e.contrat_id, e.mois, e.montant_du, e.montant_verse,
            ct.jour_echeance, ct.marge_tolerance_jours
     FROM paiements.versements v
     JOIN paiements.echeances e ON e.id = v.echeance_id
     JOIN location.contrats ct ON ct.id = e.contrat_id
     JOIN location.locataires l ON l.id = ct.locataire_id
     WHERE v.id = $1 AND l.bailleur_id = $2`,
    [versementId, bailleurId]
  );
  return r.rows[0] || null;
}

// Le bailleur confirme avoir bien reçu la somme sur son propre compte Mobile
// Money : ça applique enfin le montant au solde de l'échéance et génère le reçu.
router.put("/versements/:id/confirmer", async (req, res) => {
  const versement = await trouverVersementEnAttenteDuBailleur(req.bailleurId, req.params.id);
  if (!versement) return res.status(404).json({ ok: false, error: "Paiement introuvable." });
  if (versement.statut_versement !== "en_attente_confirmation") {
    return res.status(409).json({ ok: false, error: "Ce paiement a déjà été traité." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const nouveauVerse = Number(versement.montant_verse) + Number(versement.montant);
    const nouveauStatut = calculerStatut({
      moisISO: versement.mois.toISOString().slice(0, 10),
      montantDu: Number(versement.montant_du),
      montantVerse: nouveauVerse,
      jourEcheance: versement.jour_echeance,
      margeToleranceJours: versement.marge_tolerance_jours,
    });

    await client.query(`UPDATE paiements.echeances SET montant_verse = $1, statut = $2 WHERE id = $3`, [
      nouveauVerse,
      nouveauStatut,
      versement.echeance_id,
    ]);
    await client.query(`UPDATE paiements.versements SET statut_versement = 'confirme' WHERE id = $1`, [
      req.params.id,
    ]);

    await client.query("COMMIT");

    const recuUrl = await genererEtEnregistrerRecu(req.bailleurId, req.params.id);
    res.json({ ok: true, recu_pdf_url: recuUrl });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// Le bailleur indique n'avoir rien reçu (erreur, tentative frauduleuse...) —
// le paiement reste tracé mais ne compte pour rien.
router.put("/versements/:id/rejeter", async (req, res) => {
  const versement = await trouverVersementEnAttenteDuBailleur(req.bailleurId, req.params.id);
  if (!versement) return res.status(404).json({ ok: false, error: "Paiement introuvable." });
  if (versement.statut_versement !== "en_attente_confirmation") {
    return res.status(409).json({ ok: false, error: "Ce paiement a déjà été traité." });
  }

  try {
    await pool.query(`UPDATE paiements.versements SET statut_versement = 'rejete' WHERE id = $1`, [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Reçu PDF d'un versement : renvoie l'URL publique (/uploads/recus/...),
// en le (re)générant si besoin. Le fichier lui-même n'est pas protégé par
// jeton (comme les photos) pour rester facile à partager (WhatsApp...).

router.get("/versements/:id/recu-url", async (req, res) => {
  const rStatut = await pool.query(
    `SELECT v.statut_versement FROM paiements.versements v
     JOIN paiements.echeances e ON e.id = v.echeance_id
     JOIN location.contrats ct ON ct.id = e.contrat_id
     JOIN location.locataires l ON l.id = ct.locataire_id
     WHERE v.id = $1 AND l.bailleur_id = $2`,
    [req.params.id, req.bailleurId]
  );
  const statut = rStatut.rows[0]?.statut_versement;
  if (!statut) return res.status(404).json({ ok: false, error: "Paiement introuvable." });
  if (statut !== "confirme") {
    return res.status(409).json({
      ok: false,
      error: "Ce paiement n'est pas encore confirmé — pas de reçu tant que sa réception n'est pas confirmée.",
    });
  }

  const url = await genererEtEnregistrerRecu(req.bailleurId, req.params.id);
  if (!url) return res.status(404).json({ ok: false, error: "Paiement introuvable ou reçu impossible à générer." });
  res.json({ ok: true, url });
});

// --- Historique complet d'un contrat (échéances + versements) ---

router.get("/contrats/:id/historique", async (req, res) => {
  const contrat = await trouverContratDuBailleur(req.bailleurId, req.params.id);
  if (!contrat) return res.status(404).json({ ok: false, error: "Contrat introuvable." });

  try {
    const rEcheances = await pool.query(
      `SELECT id, mois, montant_du, montant_verse, statut
       FROM paiements.echeances WHERE contrat_id = $1 ORDER BY mois DESC`,
      [req.params.id]
    );
    const rVersements = await pool.query(
      `SELECT v.id, v.echeance_id, v.montant, v.methode, v.reference_transaction, v.verse_le
       FROM paiements.versements v
       JOIN paiements.echeances e ON e.id = v.echeance_id
       WHERE e.contrat_id = $1
       ORDER BY v.verse_le DESC`,
      [req.params.id]
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

module.exports = router;
