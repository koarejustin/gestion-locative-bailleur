// Format du numéro de CNIB burkinabè imprimé sur la carte (biométrique) :
// une lettre suivie de 8 chiffres, ex. "B12345678". C'est ce numéro-là qui
// sert de référence (le grand numéro en haut de la carte est un identifiant
// interne différent, pas celui qu'on demande habituellement).
const REGEX_CNIB = /^[A-Z]\d{8}$/;

function validerCnib(valeurBrute) {
  if (!valeurBrute || !valeurBrute.trim()) return { valeur: null, erreur: null };
  const valeur = valeurBrute.trim().toUpperCase();
  if (!REGEX_CNIB.test(valeur)) {
    return {
      valeur: null,
      erreur: "Numéro CNIB invalide — attendu : une lettre suivie de 8 chiffres (ex. B12345678).",
    };
  }
  return { valeur, erreur: null };
}

module.exports = { validerCnib };
