const express = require("express");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { upload, dossierUploads } = require("../middleware/upload");
const { premierJourDuMois, obtenirOuCreerEcheance } = require("../services/echeances");

const router = express.Router();

const TYPES_BIEN_VALIDES = ["cour", "batiment"];
const DISPOSITIONS_VALIDES = ["unique", "divisee"];
const USAGES_VALIDES = ["habitation", "commerce"];
const STYLES_CONSTRUCTION_VALIDES = ["villa", "demi_villa"];

// Valide et normalise les champs de catégorisation d'une maison/cour.
// Renvoie { valeurs, erreur } — erreur non nulle si une valeur fournie est invalide.
function validerCategorisation(body) {
  const {
    type_bien = "cour",
    disposition = "divisee",
    usage_bien = "habitation",
    style_construction,
    nombre_etages,
  } = body;

  if (!TYPES_BIEN_VALIDES.includes(type_bien)) {
    return { erreur: "Type de bien invalide." };
  }
  if (!DISPOSITIONS_VALIDES.includes(disposition)) {
    return { erreur: "Disposition invalide." };
  }
  if (!USAGES_VALIDES.includes(usage_bien)) {
    return { erreur: "Usage invalide." };
  }
  let styleNormalise = null;
  if (style_construction) {
    if (!STYLES_CONSTRUCTION_VALIDES.includes(style_construction)) {
      return { erreur: "Style de construction invalide." };
    }
    styleNormalise = style_construction;
  }
  let etagesNormalise = null;
  if (nombre_etages !== undefined && nombre_etages !== null && nombre_etages !== "") {
    const n = Number(nombre_etages);
    if (!Number.isInteger(n) || n < 0) {
      return { erreur: "Le nombre d'étages doit être un entier positif." };
    }
    etagesNormalise = n;
  }

  return {
    valeurs: {
      type_bien,
      disposition,
      usage_bien,
      style_construction: styleNormalise,
      nombre_etages: etagesNormalise,
    },
  };
}

// Équipements (salon, cuisine, douche interne, piscine...) : volontairement
// "libre" — pas de liste fermée côté serveur, le bailleur peut taper ce
// qu'il veut depuis l'interface. On se contente de nettoyer (texte, pas
// vide, pas de doublons) et de poser une limite raisonnable.
function validerEquipements(valeur) {
  if (valeur === undefined || valeur === null) return { valeurs: [] };
  if (!Array.isArray(valeur)) {
    return { erreur: "Les équipements doivent être une liste." };
  }
  const nettoyes = [];
  for (const item of valeur) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    if (t.length > 40) {
      return { erreur: "Un équipement ne peut pas dépasser 40 caractères." };
    }
    if (!nettoyes.includes(t)) nettoyes.push(t);
  }
  if (nettoyes.length > 20) {
    return { erreur: "Trop d'équipements (20 maximum)." };
  }
  return { valeurs: nettoyes };
}

// Nombre de chambres (pièces à coucher) dans une porte/unité — distinct du
// nombre d'unités (chambres/boutiques) de la maison/cour.
function validerNombreChambres(valeur) {
  if (valeur === undefined || valeur === null || valeur === "") return { valeurs: null };
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 0 || n > 50) {
    return { erreur: "Le nombre de chambres doit être un entier positif." };
  }
  return { valeurs: n };
}

// --- Aides : vérifier qu'une ressource appartient bien au bailleur connecté ---

async function trouverQuartier(bailleurId, quartierId) {
  const r = await pool.query(
    `SELECT id FROM biens.quartiers WHERE id = $1 AND bailleur_id = $2`,
    [quartierId, bailleurId]
  );
  return r.rows[0] || null;
}

async function trouverMaison(bailleurId, maisonId) {
  const r = await pool.query(
    `SELECT m.id FROM biens.maisons_cours m
     JOIN biens.quartiers q ON q.id = m.quartier_id
     WHERE m.id = $1 AND q.bailleur_id = $2`,
    [maisonId, bailleurId]
  );
  return r.rows[0] || null;
}

async function trouverChambre(bailleurId, chambreId) {
  const r = await pool.query(
    `SELECT c.id FROM biens.chambres c
     JOIN biens.maisons_cours m ON m.id = c.maison_id
     JOIN biens.quartiers q ON q.id = m.quartier_id
     WHERE c.id = $1 AND q.bailleur_id = $2`,
    [chambreId, bailleurId]
  );
  return r.rows[0] || null;
}

// --- Lecture : arbre complet quartiers > maisons/cours > chambres ---

router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         q.id AS quartier_id, q.nom AS quartier_nom,
         m.id AS maison_id, m.nom AS maison_nom, m.type_bien, m.adresse_precise,
         m.disposition, m.usage_bien, m.style_construction, m.nombre_etages, m.equipements AS maison_equipements,
         c.id AS chambre_id, c.numero_porte, c.prix_mensuel, c.statut, c.description,
         c.nombre_chambres, c.etage, c.equipements AS chambre_equipements
       FROM biens.quartiers q
       LEFT JOIN biens.maisons_cours m ON m.quartier_id = q.id
       LEFT JOIN biens.chambres c ON c.maison_id = m.id
       WHERE q.bailleur_id = $1
       ORDER BY q.nom, m.nom, c.numero_porte`,
      [req.bailleurId]
    );

    const quartiers = new Map();
    for (const ligne of r.rows) {
      if (!quartiers.has(ligne.quartier_id)) {
        quartiers.set(ligne.quartier_id, {
          id: ligne.quartier_id,
          nom: ligne.quartier_nom,
          maisons: new Map(),
        });
      }
      const quartier = quartiers.get(ligne.quartier_id);

      if (ligne.maison_id && !quartier.maisons.has(ligne.maison_id)) {
        quartier.maisons.set(ligne.maison_id, {
          id: ligne.maison_id,
          nom: ligne.maison_nom,
          type_bien: ligne.type_bien,
          adresse_precise: ligne.adresse_precise,
          disposition: ligne.disposition,
          usage_bien: ligne.usage_bien,
          style_construction: ligne.style_construction,
          nombre_etages: ligne.nombre_etages,
          equipements: ligne.maison_equipements || [],
          photos: [],
          chambres: [],
        });
      }
      if (ligne.chambre_id) {
        quartier.maisons.get(ligne.maison_id).chambres.push({
          id: ligne.chambre_id,
          numero_porte: ligne.numero_porte,
          prix_mensuel: Number(ligne.prix_mensuel),
          statut: ligne.statut,
          description: ligne.description,
          nombre_chambres: ligne.nombre_chambres,
          etage: ligne.etage,
          equipements: ligne.chambre_equipements || [],
          photos: [],
          statut_paiement: null,
        });
      }
    }

    // Récupérées à part (une requête séparée évite de dupliquer les lignes
    // du tableau ci-dessus une fois par photo).
    const rPhotos = await pool.query(
      `SELECT pm.maison_id, pm.id, pm.url
       FROM biens.photos_maison pm
       JOIN biens.maisons_cours m ON m.id = pm.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE q.bailleur_id = $1
       ORDER BY pm.maison_id, pm.ordre, pm.id`,
      [req.bailleurId]
    );
    for (const quartier of quartiers.values()) {
      for (const photo of rPhotos.rows) {
        if (quartier.maisons.has(photo.maison_id)) {
          quartier.maisons.get(photo.maison_id).photos.push({ id: photo.id, url: photo.url });
        }
      }
    }

    // Idem pour les photos propres à chaque chambre/boutique (indépendantes
    // des photos de la maison/cour — utiles surtout dans un bâtiment où
    // chaque unité peut avoir un aspect différent).
    const chambresParId = new Map();
    for (const quartier of quartiers.values()) {
      for (const maison of quartier.maisons.values()) {
        for (const chambre of maison.chambres) {
          chambresParId.set(chambre.id, chambre);
        }
      }
    }
    const rPhotosChambre = await pool.query(
      `SELECT pc.chambre_id, pc.id, pc.url
       FROM biens.photos_chambre pc
       JOIN biens.chambres c ON c.id = pc.chambre_id
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE q.bailleur_id = $1
       ORDER BY pc.chambre_id, pc.ordre, pc.id`,
      [req.bailleurId]
    );
    for (const photo of rPhotosChambre.rows) {
      const chambre = chambresParId.get(photo.chambre_id);
      if (chambre) chambre.photos.push({ id: photo.id, url: photo.url });
    }

    // Statut de paiement du mois en cours pour chaque chambre occupée — permet
    // au bailleur de voir d'un coup d'œil, sous chaque cour/bâtiment, quelles
    // portes sont à jour et lesquelles sont en retard.
    const rContrats = await pool.query(
      `SELECT ct.id AS contrat_id, ct.chambre_id, ct.loyer_mensuel, ct.jour_echeance, ct.marge_tolerance_jours
       FROM location.contrats ct
       JOIN biens.chambres c ON c.id = ct.chambre_id
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE q.bailleur_id = $1 AND ct.actif = true`,
      [req.bailleurId]
    );
    const moisISO = premierJourDuMois();
    for (const row of rContrats.rows) {
      const chambre = chambresParId.get(row.chambre_id);
      if (!chambre) continue;
      const echeance = await obtenirOuCreerEcheance(
        {
          id: row.contrat_id,
          loyer_mensuel: Number(row.loyer_mensuel),
          jour_echeance: row.jour_echeance,
          marge_tolerance_jours: row.marge_tolerance_jours,
        },
        moisISO
      );
      chambre.statut_paiement = echeance.statut;
    }

    const resultat = [...quartiers.values()].map((q) => ({
      ...q,
      maisons: [...q.maisons.values()],
    }));

    res.json({ ok: true, quartiers: resultat });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Quartiers ---

router.post("/quartiers", async (req, res) => {
  const { nom } = req.body;
  if (!nom || !nom.trim()) {
    return res.status(400).json({ ok: false, error: "Le nom du quartier est obligatoire." });
  }
  try {
    const r = await pool.query(
      `INSERT INTO biens.quartiers (bailleur_id, nom) VALUES ($1, $2) RETURNING id, nom`,
      [req.bailleurId, nom.trim()]
    );
    res.status(201).json({ ok: true, quartier: r.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Ce quartier existe déjà." });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/quartiers/:id", async (req, res) => {
  const { nom } = req.body;
  if (!nom || !nom.trim()) {
    return res.status(400).json({ ok: false, error: "Le nom du quartier est obligatoire." });
  }
  const existe = await trouverQuartier(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Quartier introuvable." });

  try {
    const r = await pool.query(
      `UPDATE biens.quartiers SET nom = $1 WHERE id = $2 RETURNING id, nom`,
      [nom.trim(), req.params.id]
    );
    res.json({ ok: true, quartier: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/quartiers/:id", async (req, res) => {
  const existe = await trouverQuartier(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Quartier introuvable." });

  try {
    await pool.query(`DELETE FROM biens.quartiers WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        ok: false,
        error: "Ce quartier contient des maisons/cours — supprime-les d'abord.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Maisons / cours ---

router.post("/maisons", async (req, res) => {
  const { quartier_id, nom, adresse_precise, prix_mensuel } = req.body;
  if (!quartier_id || !nom || !nom.trim()) {
    return res.status(400).json({ ok: false, error: "Quartier et nom sont obligatoires." });
  }
  const categorisation = validerCategorisation(req.body);
  if (categorisation.erreur) {
    return res.status(400).json({ ok: false, error: categorisation.erreur });
  }
  const equipements = validerEquipements(req.body.equipements);
  if (equipements.erreur) {
    return res.status(400).json({ ok: false, error: equipements.erreur });
  }
  const quartier = await trouverQuartier(req.bailleurId, quartier_id);
  if (!quartier) return res.status(404).json({ ok: false, error: "Quartier introuvable." });

  const c = categorisation.valeurs;
  // Une maison/cour "Unique" (une villa entière, une seule chambre à louer) a
  // toujours exactement une chambre en pratique — plutôt que de forcer le
  // bailleur à cliquer une deuxième fois sur "+ Chambre" juste après, on la
  // crée nous-mêmes dans la foulée si un prix a été renseigné.
  const creerChambreUnique = c.disposition === "unique" && prix_mensuel !== undefined && prix_mensuel !== "";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rMaison = await client.query(
      `INSERT INTO biens.maisons_cours
         (bailleur_id, quartier_id, nom, type_bien, adresse_precise, disposition, usage_bien, style_construction, nombre_etages, equipements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, nom, type_bien, adresse_precise, disposition, usage_bien, style_construction, nombre_etages, equipements`,
      [
        req.bailleurId,
        quartier_id,
        nom.trim(),
        c.type_bien,
        adresse_precise || null,
        c.disposition,
        c.usage_bien,
        c.style_construction,
        c.nombre_etages,
        equipements.valeurs,
      ]
    );
    const maison = rMaison.rows[0];
    let chambres = [];
    if (creerChambreUnique) {
      const rChambre = await client.query(
        `INSERT INTO biens.chambres (maison_id, numero_porte, prix_mensuel)
         VALUES ($1, $2, $3)
         RETURNING id, numero_porte, prix_mensuel, statut, description, nombre_chambres, etage, equipements`,
        [maison.id, "1", prix_mensuel]
      );
      const chambre = rChambre.rows[0];
      chambre.prix_mensuel = Number(chambre.prix_mensuel);
      chambre.photos = [];
      chambres = [chambre];
    }
    await client.query("COMMIT");
    res.status(201).json({ ok: true, maison: { ...maison, photos: [], chambres } });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

router.put("/maisons/:id", async (req, res) => {
  const { nom, adresse_precise } = req.body;
  if (!nom || !nom.trim()) {
    return res.status(400).json({ ok: false, error: "Le nom est obligatoire." });
  }
  const categorisation = validerCategorisation(req.body);
  if (categorisation.erreur) {
    return res.status(400).json({ ok: false, error: categorisation.erreur });
  }
  const equipements = validerEquipements(req.body.equipements);
  if (equipements.erreur) {
    return res.status(400).json({ ok: false, error: equipements.erreur });
  }
  const existe = await trouverMaison(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Maison/cour introuvable." });

  try {
    const c = categorisation.valeurs;
    const r = await pool.query(
      `UPDATE biens.maisons_cours
       SET nom = $1, type_bien = $2, adresse_precise = $3, disposition = $4,
           usage_bien = $5, style_construction = $6, nombre_etages = $7, equipements = $8
       WHERE id = $9
       RETURNING id, nom, type_bien, adresse_precise, disposition, usage_bien, style_construction, nombre_etages, equipements`,
      [
        nom.trim(),
        c.type_bien,
        adresse_precise || null,
        c.disposition,
        c.usage_bien,
        c.style_construction,
        c.nombre_etages,
        equipements.valeurs,
        req.params.id,
      ]
    );
    res.json({ ok: true, maison: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/maisons/:id", async (req, res) => {
  const existe = await trouverMaison(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Maison/cour introuvable." });

  try {
    await pool.query(`DELETE FROM biens.maisons_cours WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Photos de la maison/cour ---

router.post("/maisons/:id/photos", upload.array("photos", 8), async (req, res) => {
  const maison = await trouverMaison(req.bailleurId, req.params.id);
  if (!maison) return res.status(404).json({ ok: false, error: "Maison/cour introuvable." });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ ok: false, error: "Aucune photo reçue." });
  }

  try {
    const photos = [];
    for (const fichier of req.files) {
      const url = `/uploads/${fichier.filename}`;
      const r = await pool.query(
        `INSERT INTO biens.photos_maison (maison_id, url) VALUES ($1, $2) RETURNING id, url`,
        [req.params.id, url]
      );
      photos.push(r.rows[0]);
    }
    res.status(201).json({ ok: true, photos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/photos-maison/:photoId", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.id, p.url FROM biens.photos_maison p
       JOIN biens.maisons_cours m ON m.id = p.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE p.id = $1 AND q.bailleur_id = $2`,
      [req.params.photoId, req.bailleurId]
    );
    const photo = r.rows[0];
    if (!photo) return res.status(404).json({ ok: false, error: "Photo introuvable." });

    await pool.query(`DELETE FROM biens.photos_maison WHERE id = $1`, [photo.id]);
    // Best-effort : si le fichier a déjà disparu du disque, ce n'est pas grave.
    fs.unlink(path.join(dossierUploads, path.basename(photo.url)), () => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Chambres ---

router.post("/chambres", async (req, res) => {
  const { maison_id, numero_porte, prix_mensuel, description, etage } = req.body;
  if (!maison_id || !numero_porte || !String(numero_porte).trim() || prix_mensuel === undefined) {
    return res.status(400).json({
      ok: false,
      error: "Maison, numéro de porte et prix mensuel sont obligatoires.",
    });
  }
  const nombreChambres = validerNombreChambres(req.body.nombre_chambres);
  if (nombreChambres.erreur) {
    return res.status(400).json({ ok: false, error: nombreChambres.erreur });
  }
  const equipements = validerEquipements(req.body.equipements);
  if (equipements.erreur) {
    return res.status(400).json({ ok: false, error: equipements.erreur });
  }
  const maison = await trouverMaison(req.bailleurId, maison_id);
  if (!maison) return res.status(404).json({ ok: false, error: "Maison/cour introuvable." });

  try {
    const r = await pool.query(
      `INSERT INTO biens.chambres (maison_id, numero_porte, prix_mensuel, description, nombre_chambres, etage, equipements)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, numero_porte, prix_mensuel, statut, description, nombre_chambres, etage, equipements`,
      [
        maison_id,
        String(numero_porte).trim(),
        prix_mensuel,
        description || null,
        nombreChambres.valeurs,
        etage ? String(etage).trim() || null : null,
        equipements.valeurs,
      ]
    );
    const chambre = r.rows[0];
    chambre.prix_mensuel = Number(chambre.prix_mensuel);
    chambre.photos = [];
    res.status(201).json({ ok: true, chambre });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Ce numéro de porte existe déjà dans cette maison/cour.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/chambres/:id", async (req, res) => {
  const { numero_porte, prix_mensuel, statut, description, etage } = req.body;
  if (!numero_porte || !String(numero_porte).trim() || prix_mensuel === undefined) {
    return res.status(400).json({
      ok: false,
      error: "Numéro de porte et prix mensuel sont obligatoires.",
    });
  }
  const nombreChambres = validerNombreChambres(req.body.nombre_chambres);
  if (nombreChambres.erreur) {
    return res.status(400).json({ ok: false, error: nombreChambres.erreur });
  }
  const equipements = validerEquipements(req.body.equipements);
  if (equipements.erreur) {
    return res.status(400).json({ ok: false, error: equipements.erreur });
  }
  const existe = await trouverChambre(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Chambre introuvable." });

  try {
    const r = await pool.query(
      `UPDATE biens.chambres
       SET numero_porte = $1, prix_mensuel = $2, statut = $3, description = $4,
           nombre_chambres = $5, etage = $6, equipements = $7
       WHERE id = $8
       RETURNING id, numero_porte, prix_mensuel, statut, description, nombre_chambres, etage, equipements`,
      [
        String(numero_porte).trim(),
        prix_mensuel,
        statut || "libre",
        description || null,
        nombreChambres.valeurs,
        etage ? String(etage).trim() || null : null,
        equipements.valeurs,
        req.params.id,
      ]
    );
    const chambre = r.rows[0];
    chambre.prix_mensuel = Number(chambre.prix_mensuel);
    res.json({ ok: true, chambre });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Ce numéro de porte existe déjà dans cette maison/cour.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Création en masse : au lieu d'ajouter chaque porte une par une, on indique
// un préfixe + un nombre et toutes les portes sont créées d'un coup avec le
// même prix/détail de départ (à ajuster ensuite individuellement si besoin).
router.post("/maisons/:id/chambres-lot", async (req, res) => {
  const { prefixe, depart, quantite, prix_mensuel, description, etage } = req.body;

  if (!prefixe || !String(prefixe).trim()) {
    return res.status(400).json({ ok: false, error: "Le préfixe (ex. A) est obligatoire." });
  }
  const depDepart = depart === undefined || depart === "" ? 1 : Number(depart);
  if (!Number.isInteger(depDepart) || depDepart < 1) {
    return res.status(400).json({ ok: false, error: "Le numéro de départ doit être un entier positif." });
  }
  const qte = Number(quantite);
  if (!Number.isInteger(qte) || qte < 1 || qte > 60) {
    return res.status(400).json({ ok: false, error: "Le nombre de portes doit être entre 1 et 60." });
  }
  if (prix_mensuel === undefined || prix_mensuel === null || prix_mensuel === "") {
    return res.status(400).json({ ok: false, error: "Le prix mensuel est obligatoire." });
  }
  const nombreChambres = validerNombreChambres(req.body.nombre_chambres);
  if (nombreChambres.erreur) {
    return res.status(400).json({ ok: false, error: nombreChambres.erreur });
  }
  const equipements = validerEquipements(req.body.equipements);
  if (equipements.erreur) {
    return res.status(400).json({ ok: false, error: equipements.erreur });
  }

  const maison = await trouverMaison(req.bailleurId, req.params.id);
  if (!maison) return res.status(404).json({ ok: false, error: "Maison/cour introuvable." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const chambres = [];
    for (let i = 0; i < qte; i += 1) {
      const numeroPorte = `${String(prefixe).trim()}${depDepart + i}`;
      const r = await client.query(
        `INSERT INTO biens.chambres (maison_id, numero_porte, prix_mensuel, description, nombre_chambres, etage, equipements)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, numero_porte, prix_mensuel, statut, description, nombre_chambres, etage, equipements`,
        [
          req.params.id,
          numeroPorte,
          prix_mensuel,
          description || null,
          nombreChambres.valeurs,
          etage ? String(etage).trim() || null : null,
          equipements.valeurs,
        ]
      );
      const chambre = r.rows[0];
      chambre.prix_mensuel = Number(chambre.prix_mensuel);
      chambre.photos = [];
      chambres.push(chambre);
    }
    await client.query("COMMIT");
    res.status(201).json({ ok: true, chambres });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "Au moins un des numéros de porte générés existe déjà dans cette maison/cour — change le préfixe ou le numéro de départ.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

router.delete("/chambres/:id", async (req, res) => {
  const existe = await trouverChambre(req.bailleurId, req.params.id);
  if (!existe) return res.status(404).json({ ok: false, error: "Chambre introuvable." });

  try {
    await pool.query(`DELETE FROM biens.chambres WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        ok: false,
        error: "Cette chambre a un contrat de location actif — impossible de la supprimer.",
      });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Photos de la chambre/boutique ---
// Indépendantes des photos de la maison/cour : utiles quand les unités d'un
// même bâtiment (ex. un célibatorium) ne se ressemblent pas entre elles.

router.post("/chambres/:id/photos", upload.array("photos", 8), async (req, res) => {
  const chambre = await trouverChambre(req.bailleurId, req.params.id);
  if (!chambre) return res.status(404).json({ ok: false, error: "Chambre introuvable." });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ ok: false, error: "Aucune photo reçue." });
  }

  try {
    const photos = [];
    for (const fichier of req.files) {
      const url = `/uploads/${fichier.filename}`;
      const r = await pool.query(
        `INSERT INTO biens.photos_chambre (chambre_id, url) VALUES ($1, $2) RETURNING id, url`,
        [req.params.id, url]
      );
      photos.push(r.rows[0]);
    }
    res.status(201).json({ ok: true, photos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/photos-chambre/:photoId", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.id, p.url FROM biens.photos_chambre p
       JOIN biens.chambres c ON c.id = p.chambre_id
       JOIN biens.maisons_cours m ON m.id = c.maison_id
       JOIN biens.quartiers q ON q.id = m.quartier_id
       WHERE p.id = $1 AND q.bailleur_id = $2`,
      [req.params.photoId, req.bailleurId]
    );
    const photo = r.rows[0];
    if (!photo) return res.status(404).json({ ok: false, error: "Photo introuvable." });

    await pool.query(`DELETE FROM biens.photos_chambre WHERE id = $1`, [photo.id]);
    // Best-effort : si le fichier a déjà disparu du disque, ce n'est pas grave.
    fs.unlink(path.join(dossierUploads, path.basename(photo.url)), () => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
