// Crée la base de données cible si elle n'existe pas encore, en se connectant
// à la base d'administration "postgres" (toujours présente sur un serveur PostgreSQL).
// Permet de ne plus dépendre d'une commande tapée à la main dans psql.
require("dotenv").config();
const { Client } = require("pg");

function getDbNameAndAdminUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  return { dbName, adminUrl: adminUrl.toString() };
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant dans .env (copie .env.example en .env et complète-le).");
    process.exit(1);
  }

  const { dbName, adminUrl } = getDbNameAndAdminUrl(process.env.DATABASE_URL);
  if (!dbName) {
    console.error('DATABASE_URL doit inclure un nom de base, ex: ".../gestion_locative"');
    process.exit(1);
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);

  if (rows.length > 0) {
    console.log(`La base "${dbName}" existe déjà, rien à faire.`);
  } else {
    // Un nom de base ne peut pas être passé en paramètre lié ($1) en SQL,
    // on l'échappe donc nous-mêmes (guillemets doublés) avant de l'insérer.
    const safeName = dbName.replace(/"/g, '""');
    await client.query(`CREATE DATABASE "${safeName}"`);
    console.log(`Base "${dbName}" créée.`);
  }

  await client.end();
}

run().catch((err) => {
  console.error("Échec de la création de la base :", err.message);
  process.exit(1);
});
