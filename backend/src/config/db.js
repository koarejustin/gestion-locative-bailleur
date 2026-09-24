const { Pool } = require("pg");
require("dotenv").config();

// En local (localhost/127.0.0.1), pas de chiffrement nécessaire. Pour une
// base distante (Supabase, etc.), le chiffrement SSL est obligatoire.
const estLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: estLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Erreur inattendue sur le pool PostgreSQL:", err);
  process.exit(1);
});

module.exports = pool;
