const jwt = require("jsonwebtoken");

// Vérifie le jeton JWT envoyé par le frontend (en-tête "Authorization: Bearer <jeton>")
// et attache l'identifiant du bailleur connecté à la requête.
function authentifier(req, res, next) {
  const entete = req.headers.authorization || "";
  const [type, jeton] = entete.split(" ");

  if (type !== "Bearer" || !jeton) {
    return res.status(401).json({ ok: false, error: "Authentification requise." });
  }

  try {
    const contenu = jwt.verify(jeton, process.env.JWT_SECRET);
    // Un jeton locataire (role: "locataire") ne doit jamais donner accès aux
    // routes bailleur, même si en pratique bailleurId serait "undefined" et
    // ne correspondrait à rien côté base — mieux vaut un rejet explicite
    // qu'une protection accidentelle.
    if (contenu.role) {
      return res.status(403).json({ ok: false, error: "Accès réservé au bailleur." });
    }
    req.bailleurId = contenu.bailleurId;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Session expirée, reconnecte-toi." });
  }
}

// Même principe mais pour l'espace locataire (jeton avec role = "locataire").
// Utilisé par le futur module de consultation locataire (contrat, paiements).
function authentifierLocataire(req, res, next) {
  const entete = req.headers.authorization || "";
  const [type, jeton] = entete.split(" ");

  if (type !== "Bearer" || !jeton) {
    return res.status(401).json({ ok: false, error: "Authentification requise." });
  }

  try {
    const contenu = jwt.verify(jeton, process.env.JWT_SECRET);
    if (contenu.role !== "locataire") {
      return res.status(403).json({ ok: false, error: "Accès réservé aux locataires." });
    }
    req.locataireId = contenu.locataireId;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Session expirée, reconnecte-toi." });
  }
}

module.exports = authentifier;
module.exports.authentifierLocataire = authentifierLocataire;
