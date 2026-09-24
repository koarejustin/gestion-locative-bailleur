const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const DOSSIER_RECUS = path.join(__dirname, "..", "..", "uploads", "recus");
if (!fs.existsSync(DOSSIER_RECUS)) fs.mkdirSync(DOSSIER_RECUS, { recursive: true });

const METHODE_LABEL = {
  orange_money: "Orange Money",
  moov_money: "Moov Money",
  wave: "Wave",
  especes: "Espèces",
};

function formaterFcfa(montant) {
  // Espace normal (pas l'espace insécable renvoyée par toLocaleString) —
  // la police standard utilisée par pdfkit ne l'affiche pas correctement.
  const separateurMilliers = Number(montant)
    .toLocaleString("fr-FR")
    .replace(/ | /g, " ");
  return `${separateurMilliers} FCFA`;
}

function formaterDateHeure(date) {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function numeroRecu(versementId) {
  return `REC-${String(versementId).padStart(6, "0")}`;
}

function nomFichierRecu(versementId) {
  return `recu-${versementId}.pdf`;
}

function cheminRecu(versementId) {
  return path.join(DOSSIER_RECUS, nomFichierRecu(versementId));
}

function urlRecu(versementId) {
  return `/uploads/recus/${nomFichierRecu(versementId)}`;
}

// Construit le PDF du reçu et le sauvegarde sur disque. Régénéré à chaque
// appel (les infos peuvent changer, ex. un versement suivant modifie le
// "reste à payer" affiché) — pdfkit est largement assez rapide pour ça.
function genererRecuPdf(donnees) {
  const { versement, bailleur, locataire, chambre, echeance } = donnees;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 40 });
    const flux = fs.createWriteStream(cheminRecu(versement.id));
    doc.pipe(flux);

    doc.fontSize(18).fillColor("#1F3A5F").text("Reçu de paiement", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#64748B").text(numeroRecu(versement.id), { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10).fillColor("#1F2937");
    doc.text(`Bailleur : ${bailleur.nom_complet}`);
    if (bailleur.telephone) doc.text(`Téléphone : ${bailleur.telephone}`);
    doc.moveDown(0.5);
    doc.text(`Locataire : ${locataire.nom_complet}`);
    doc.text(`Téléphone : ${locataire.telephone}`);
    doc.moveDown(0.5);
    doc.text(
      `Logement : Porte ${chambre.numero_porte} — ${chambre.maison_nom} (${chambre.quartier_nom})`
    );
    doc.moveDown(1);

    ligneSeparation(doc);

    doc.fontSize(12).fillColor("#1F3A5F").text("Détails du paiement");
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#1F2937");
    doc.text(`Montant versé : ${formaterFcfa(versement.montant)}`);
    doc.text(`Moyen de paiement : ${METHODE_LABEL[versement.methode] || versement.methode}`);
    if (versement.reference_transaction) {
      doc.text(`Référence de transaction : ${versement.reference_transaction}`);
    }
    doc.text(`Date et heure : ${formaterDateHeure(versement.verse_le)}`);
    doc.moveDown(1);

    ligneSeparation(doc);

    doc.fontSize(12).fillColor("#1F3A5F").text("Situation du mois");
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#1F2937");
    doc.text(`Loyer dû : ${formaterFcfa(echeance.montant_du)}`);
    doc.text(`Total versé ce mois : ${formaterFcfa(echeance.montant_verse)}`);
    const reste = Math.max(0, echeance.montant_du - echeance.montant_verse);
    doc.text(`Reste à payer : ${reste > 0 ? formaterFcfa(reste) : "0 FCFA — loyer du mois complet"}`);

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor("#94A3B8")
      .text(`Reçu généré automatiquement le ${formaterDateHeure(new Date())} — Gestion Locative`, {
        align: "center",
      });

    doc.end();
    flux.on("finish", () => resolve(urlRecu(versement.id)));
    flux.on("error", reject);
  });
}

function ligneSeparation(doc) {
  doc
    .moveTo(40, doc.y)
    .lineTo(doc.page.width - 40, doc.y)
    .strokeColor("#E2E8F0")
    .stroke();
  doc.moveDown(0.8);
}

module.exports = { genererRecuPdf, urlRecu };
