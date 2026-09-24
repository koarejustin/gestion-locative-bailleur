const nodemailer = require("nodemailer");

// Envoi d'email via un compte Gmail (mot de passe d'application, pas le
// mot de passe normal du compte Google — voir README pour la marche à
// suivre). Tant que GMAIL_UTILISATEUR / GMAIL_MOT_DE_PASSE_APPLICATION ne
// sont pas renseignés dans .env, on bascule en mode test : rien n'est
// envoyé réellement, le contenu est juste écrit dans les logs du serveur,
// ce qui permet de développer/tester sans compte Gmail.

let transporteur = null;
let modeTest = false;

function obtenirTransporteur() {
  if (transporteur) return transporteur;

  const { GMAIL_UTILISATEUR, GMAIL_MOT_DE_PASSE_APPLICATION } = process.env;
  if (!GMAIL_UTILISATEUR || !GMAIL_MOT_DE_PASSE_APPLICATION) {
    modeTest = true;
    transporteur = nodemailer.createTransport({ jsonTransport: true });
    return transporteur;
  }

  transporteur = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_UTILISATEUR, pass: GMAIL_MOT_DE_PASSE_APPLICATION },
  });
  return transporteur;
}

async function envoyerEmail({ to, sujet, texte, html }) {
  const t = obtenirTransporteur();
  const expediteur = process.env.GMAIL_UTILISATEUR || "gestion-locative@local.test";

  await t.sendMail({
    from: `"Gestion Locative" <${expediteur}>`,
    to,
    subject: sujet,
    text: texte,
    html,
  });

  if (modeTest) {
    console.log(
      `[email - mode test, rien n'est réellement envoyé] à: ${to} | sujet: ${sujet}\n${texte}`
    );
  }
}

function urlFrontend() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

async function envoyerEmailVerification({ email, bailleurId, nomComplet, token }) {
  const lien = `${urlFrontend()}/verifier-email?id=${bailleurId}&token=${token}`;
  await envoyerEmail({
    to: email,
    sujet: "Vérifie ton adresse email — Gestion Locative",
    texte: `Bonjour ${nomComplet},\n\nClique sur ce lien pour vérifier ton adresse email :\n${lien}\n\nCe lien expire dans 24h. Si tu n'es pas à l'origine de cette inscription, ignore cet email.`,
    html: `<p>Bonjour ${nomComplet},</p><p>Clique sur ce lien pour vérifier ton adresse email :</p><p><a href="${lien}">${lien}</a></p><p>Ce lien expire dans 24h. Si tu n'es pas à l'origine de cette inscription, ignore cet email.</p>`,
  });
}

async function envoyerMotDePasseTemporaire({ email, nomComplet, motDePasseTemporaire }) {
  await envoyerEmail({
    to: email,
    sujet: "Ton nouveau mot de passe — Gestion Locative",
    texte: `Bonjour ${nomComplet},\n\nVoici un nouveau mot de passe temporaire pour te connecter :\n\n${motDePasseTemporaire}\n\nConnecte-toi avec, puis change-le dès que possible depuis l'application. Si tu n'as pas demandé cette réinitialisation, contacte-nous rapidement.`,
    html: `<p>Bonjour ${nomComplet},</p><p>Voici un nouveau mot de passe temporaire pour te connecter :</p><p style="font-size:18px;font-weight:bold;letter-spacing:1px;">${motDePasseTemporaire}</p><p>Connecte-toi avec, puis change-le dès que possible depuis l'application. Si tu n'as pas demandé cette réinitialisation, contacte-nous rapidement.</p>`,
  });
}

async function envoyerCodeVerificationCandidature({ email, nomComplet, code }) {
  await envoyerEmail({
    to: email,
    sujet: "Ton code de vérification — Gestion Locative",
    texte: `Bonjour ${nomComplet},\n\nVoici ton code pour confirmer ton adresse email et continuer ta candidature :\n\n${code}\n\nCe code expire dans 15 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
    html: `<p>Bonjour ${nomComplet},</p><p>Voici ton code pour confirmer ton adresse email et continuer ta candidature :</p><p style="font-size:22px;font-weight:bold;letter-spacing:3px;">${code}</p><p>Ce code expire dans 15 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
  });
}

async function envoyerConfirmationSignature({ email, nomComplet, logement, loyerMensuel, cautionMontant }) {
  await envoyerEmail({
    to: email,
    sujet: "Contrat signé — Gestion Locative",
    texte: `Bonjour ${nomComplet},\n\nTon contrat pour "${logement}" vient d'être signé électroniquement.\n\nLoyer mensuel : ${loyerMensuel} FCFA\nCaution : ${cautionMontant} FCFA\n\nTu peux dès maintenant te connecter à ton espace locataire avec le téléphone et le mot de passe que tu as choisis pour consulter ton contrat, suivre tes paiements et déclarer un versement.`,
    html: `<p>Bonjour ${nomComplet},</p><p>Ton contrat pour <strong>${logement}</strong> vient d'être signé électroniquement.</p><ul><li>Loyer mensuel : ${loyerMensuel} FCFA</li><li>Caution : ${cautionMontant} FCFA</li></ul><p>Tu peux dès maintenant te connecter à ton espace locataire avec le téléphone et le mot de passe que tu as choisis pour consulter ton contrat, suivre tes paiements et déclarer un versement.</p>`,
  });
}

module.exports = {
  envoyerEmail,
  envoyerEmailVerification,
  envoyerMotDePasseTemporaire,
  envoyerCodeVerificationCandidature,
  envoyerConfirmationSignature,
};
