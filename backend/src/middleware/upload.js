const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Toutes les photos (maison/cour, chambre plus tard) atterrissent dans backend/uploads/,
// servi statiquement par Express (voir server.js).
const dossierUploads = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(dossierUploads)) {
  fs.mkdirSync(dossierUploads, { recursive: true });
}

const stockage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dossierUploads),
  filename: (req, file, cb) => {
    const suffixe = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${suffixe}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function filtrerImages(req, file, cb) {
  const extensionsAutorisees = [".jpg", ".jpeg", ".png", ".webp"];
  const extension = path.extname(file.originalname).toLowerCase();
  if (!extensionsAutorisees.includes(extension)) {
    return cb(new Error("Seules les images (jpg, png, webp) sont acceptées."));
  }
  cb(null, true);
}

const upload = multer({
  storage: stockage,
  fileFilter: filtrerImages,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5 Mo par photo, 8 photos max par envoi
});

module.exports = { upload, dossierUploads };
