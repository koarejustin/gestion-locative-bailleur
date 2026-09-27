const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Les fichiers reçus sont gardés en mémoire (buffer), pas écrits sur disque :
// ils sont ensuite envoyés vers Supabase Storage (voir services/stockage.js),
// qui persiste — contrairement au disque du serveur sur Render (gratuit),
// effacé à chaque nouveau déploiement.
const stockageMemoire = multer.memoryStorage();

// Dossier local de secours, utilisé par services/stockage.js uniquement
// quand SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ne sont pas renseignées
// (développement local sans compte Supabase Storage configuré).
const dossierUploads = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(dossierUploads)) {
  fs.mkdirSync(dossierUploads, { recursive: true });
}

function filtrerImages(req, file, cb) {
  const extensionsAutorisees = [".jpg", ".jpeg", ".png", ".webp"];
  const extension = path.extname(file.originalname).toLowerCase();
  if (!extensionsAutorisees.includes(extension)) {
    return cb(new Error("Seules les images (jpg, png, webp) sont acceptées."));
  }
  cb(null, true);
}

const upload = multer({
  storage: stockageMemoire,
  fileFilter: filtrerImages,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5 Mo par photo, 8 photos max par envoi
});

module.exports = { upload, dossierUploads };
