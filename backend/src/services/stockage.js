const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { dossierUploads } = require("../middleware/upload");

// Sur Render (offre gratuite), le disque du serveur est effacé à chaque
// nouveau déploiement — une photo écrite là ne survit pas au prochain
// "git push". On envoie donc les photos vers Supabase Storage (persistant,
// même Supabase que la base de données) à la place.
//
// Tant que SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ne sont pas renseignées
// (ex. développement local sans compte Supabase configuré), on retombe sur
// le disque local — pratique pour tester sans rien configurer.

const NOM_BUCKET = "photos";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

function nomFichierUnique(nomOriginal) {
  const suffixe = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${suffixe}${path.extname(nomOriginal).toLowerCase()}`;
}

// `fichier` est l'objet donné par multer (memoryStorage) : { buffer, originalname, mimetype }.
// Retourne l'URL publique à stocker en base.
async function televerserPhoto(fichier) {
  const nomFichier = nomFichierUnique(fichier.originalname);

  if (!supabase) {
    fs.writeFileSync(path.join(dossierUploads, nomFichier), fichier.buffer);
    return `/uploads/${nomFichier}`;
  }

  const { error } = await supabase.storage
    .from(NOM_BUCKET)
    .upload(nomFichier, fichier.buffer, { contentType: fichier.mimetype, upsert: false });
  if (error) {
    throw new Error(`Envoi de la photo impossible : ${error.message}`);
  }

  const { data } = supabase.storage.from(NOM_BUCKET).getPublicUrl(nomFichier);
  return data.publicUrl;
}

// Même principe pour les reçus PDF (voir services/recus.js), rangés sous un
// préfixe "recus/" dans le même bucket — pas besoin d'en créer un second.
// Contrairement aux photos, un reçu est régénéré sous le même nom de
// fichier à chaque appel (ex. un versement suivant change le "reste à
// payer" affiché dessus), donc on écrase l'ancien (upsert).
const PREFIXE_RECUS = "recus";

async function televerserRecu(buffer, nomFichier) {
  if (!supabase) {
    const dossierRecusLocal = path.join(dossierUploads, PREFIXE_RECUS);
    if (!fs.existsSync(dossierRecusLocal)) fs.mkdirSync(dossierRecusLocal, { recursive: true });
    fs.writeFileSync(path.join(dossierRecusLocal, nomFichier), buffer);
    return `/uploads/${PREFIXE_RECUS}/${nomFichier}`;
  }

  const chemin = `${PREFIXE_RECUS}/${nomFichier}`;
  const { error } = await supabase.storage
    .from(NOM_BUCKET)
    .upload(chemin, buffer, { contentType: "application/pdf", upsert: true });
  if (error) {
    throw new Error(`Envoi du reçu impossible : ${error.message}`);
  }

  const { data } = supabase.storage.from(NOM_BUCKET).getPublicUrl(chemin);
  return data.publicUrl;
}

// Best-effort : si le fichier a déjà disparu (ou n'a jamais existé), ce
// n'est pas grave, on ne bloque jamais l'appelant pour ça.
async function supprimerPhoto(url) {
  if (!url) return;

  if (!supabase || url.startsWith("/uploads/")) {
    fs.unlink(path.join(dossierUploads, path.basename(url)), () => {});
    return;
  }

  const nomFichier = url.split(`/${NOM_BUCKET}/`).pop();
  if (!nomFichier) return;
  try {
    await supabase.storage.from(NOM_BUCKET).remove([nomFichier]);
  } catch {
    // best-effort
  }
}

module.exports = { televerserPhoto, supprimerPhoto, televerserRecu };
