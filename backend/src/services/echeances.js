const pool = require("../config/db");

// Premier jour du mois pour une date donnée (ou aujourd'hui si non précisé).
// Toujours travaillé en "YYYY-MM-01" (chaîne) pour coller au type DATE de Postgres
// sans embêtements de fuseau horaire.
function premierJourDuMois(date = new Date()) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  return `${annee}-${mois}-01`;
}

// Calcule le statut d'une échéance : à jour / partielle / en retard / en attente.
// - "a_jour"     : le montant versé couvre (ou dépasse) le loyer dû.
// - "en_retard"  : la date limite (jour d'échéance + marge de tolérance) est dépassée
//                  et le montant dû n'est pas couvert (versé partiel ou nul).
// - "partiel"    : un versement a été fait, montant encore dû, mais délai pas dépassé.
// - "en_attente" : rien versé, délai pas dépassé.
function calculerStatut({ moisISO, montantDu, montantVerse, jourEcheance, margeToleranceJours }) {
  if (montantVerse >= montantDu) return "a_jour";

  const [annee, mois] = moisISO.split("-").map(Number);
  const dateLimite = new Date(annee, mois - 1, jourEcheance + margeToleranceJours);
  const maintenant = new Date();

  if (maintenant > dateLimite) return "en_retard";
  return montantVerse > 0 ? "partiel" : "en_attente";
}

// Retourne l'échéance d'un contrat pour un mois donné, en la créant si elle
// n'existe pas encore (une échéance n'est générée qu'au moment où on en a besoin
// — pas de job cron nécessaire). Recalcule et sauvegarde le statut au passage,
// car le temps peut avoir fait passer une échéance "en_attente" à "en_retard".
async function obtenirOuCreerEcheance(contrat, moisISO = premierJourDuMois()) {
  let r = await pool.query(
    `SELECT id, contrat_id, mois, montant_du, montant_verse, statut
     FROM paiements.echeances WHERE contrat_id = $1 AND mois = $2`,
    [contrat.id, moisISO]
  );

  let echeance = r.rows[0];
  if (!echeance) {
    r = await pool.query(
      `INSERT INTO paiements.echeances (contrat_id, mois, montant_du, montant_verse, statut)
       VALUES ($1, $2, $3, 0, 'en_attente')
       ON CONFLICT (contrat_id, mois) DO UPDATE SET mois = EXCLUDED.mois
       RETURNING id, contrat_id, mois, montant_du, montant_verse, statut`,
      [contrat.id, moisISO, contrat.loyer_mensuel]
    );
    echeance = r.rows[0];
  }

  const statutRecalcule = calculerStatut({
    moisISO,
    montantDu: Number(echeance.montant_du),
    montantVerse: Number(echeance.montant_verse),
    jourEcheance: contrat.jour_echeance,
    margeToleranceJours: contrat.marge_tolerance_jours,
  });

  if (statutRecalcule !== echeance.statut) {
    await pool.query(`UPDATE paiements.echeances SET statut = $1 WHERE id = $2`, [
      statutRecalcule,
      echeance.id,
    ]);
    echeance.statut = statutRecalcule;
  }

  echeance.montant_du = Number(echeance.montant_du);
  echeance.montant_verse = Number(echeance.montant_verse);
  return echeance;
}

module.exports = { premierJourDuMois, calculerStatut, obtenirOuCreerEcheance };
