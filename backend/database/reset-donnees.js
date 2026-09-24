// Supprime TOUTES les données (comptes bailleurs, quartiers, maisons, chambres,
// locataires, contrats, paiements) et les photos uploadées — mais garde le
// schéma de la base intact (pas besoin de refaire `npm run migrate` après).
//
// Utile avant un vrai déploiement : tout ce que tu as créé pendant les tests
// (comptes de test, quartiers "QuartierE2E", etc.) disparaît, et l'appli
// repart sur une base vide, prête pour le premier vrai compte bailleur.
//
// Sécurité : par défaut ce script ne fait qu'un aperçu (aucune suppression).
// Il faut explicitement lancer `npm run reset-donnees:confirmer` pour que la
// suppression ait réellement lieu.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

const CONFIRME = process.argv.includes("--confirmer");
const DOSSIER_UPLOADS = path.join(__dirname, "..", "uploads");

// Ordre sans importance : TRUNCATE ... CASCADE supprime aussi les tables liées
// par clé étrangère. RESTART IDENTITY remet les compteurs (id) à 1.
const TABLES = [
  "comptes.bailleurs",
  "biens.quartiers",
  "biens.maisons_cours",
  "biens.chambres",
  "biens.photos_maison",
  "biens.photos_chambre",
  "location.locataires",
  "location.contrats",
  "location.etats_des_lieux",
  "location.visites",
  "paiements.echeances",
  "paiements.versements",
];

function compterFichiersUploads() {
  if (!fs.existsSync(DOSSIER_UPLOADS)) return 0;
  return fs.readdirSync(DOSSIER_UPLOADS).filter((f) => f !== ".gitkeep").length;
}

function viderDossierUploads() {
  if (!fs.existsSync(DOSSIER_UPLOADS)) return;
  for (const fichier of fs.readdirSync(DOSSIER_UPLOADS)) {
    if (fichier === ".gitkeep") continue;
    fs.unlinkSync(path.join(DOSSIER_UPLOADS, fichier));
  }
}

async function run() {
  const nbFichiers = compterFichiersUploads();

  if (!CONFIRME) {
    console.log("Aperçu (rien n'est supprimé) :\n");
    for (const table of TABLES) {
      const { rows } = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  ${table.padEnd(28)} ${rows[0].count} ligne(s)`);
    }
    console.log(`  ${"uploads/ (photos)".padEnd(28)} ${nbFichiers} fichier(s)`);
    console.log(
      "\nRien n'a été supprimé. Pour vraiment tout effacer et repartir de zéro :\n" +
        "  npm run reset-donnees:confirmer\n"
    );
    await pool.end();
    return;
  }

  console.log("Suppression en cours...");
  await pool.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  viderDossierUploads();
  console.log("Base de données et photos remises à zéro. Le schéma (les tables) est intact.");
  console.log("Prochaine étape : crée le premier vrai compte bailleur depuis l'appli.");
  await pool.end();
}

run().catch((err) => {
  console.error("Échec de la remise à zéro :", err.message);
  process.exit(1);
});
