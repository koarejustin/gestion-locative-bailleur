const jwt = require("jsonwebtoken");

// Fabrique les jetons JWT des deux espaces (bailleur / locataire), au même
// endroit pour que la forme du jeton locataire ne diverge jamais entre les
// deux façons de créer un compte locataire (activation manuelle par le
// bailleur, ou signature électronique en ligne).

function genererJetonBailleur(bailleur) {
  return jwt.sign(
    { bailleurId: bailleur.id, nom_complet: bailleur.nom_complet },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function genererJetonLocataire(locataire) {
  return jwt.sign(
    { locataireId: locataire.id, role: "locataire", nom_complet: locataire.nom_complet },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

module.exports = { genererJetonBailleur, genererJetonLocataire };
