// Applique les fichiers .sql de database/migrations/ dans l'ordre alphabétique,
// une seule fois chacun (suivi dans la table public.schema_migrations).
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const pool = require("../src/config/db");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      nom_fichier TEXT PRIMARY KEY,
      applique_le TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function migrationsDejaAppliquees() {
  const { rows } = await pool.query("SELECT nom_fichier FROM public.schema_migrations");
  return new Set(rows.map((r) => r.nom_fichier));
}

async function run() {
  await ensureMigrationsTable();
  const appliquees = await migrationsDejaAppliquees();

  const fichiers = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const fichier of fichiers) {
    if (appliquees.has(fichier)) {
      console.log(`(déjà appliquée) ${fichier}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fichier), "utf8");
    console.log(`Application de ${fichier}...`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO public.schema_migrations (nom_fichier) VALUES ($1)", [fichier]);
      await client.query("COMMIT");
      console.log(`  -> OK`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  -> ECHEC sur ${fichier} :`, err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log("Toutes les migrations sont à jour.");
  await pool.end();
}

run();
