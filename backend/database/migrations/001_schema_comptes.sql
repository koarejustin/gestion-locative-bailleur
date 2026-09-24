-- Schéma "comptes" : bailleurs, gérants/collecteurs, journal des actions

CREATE SCHEMA IF NOT EXISTS comptes;

CREATE TABLE comptes.bailleurs (
    id                  SERIAL PRIMARY KEY,
    nom_complet         VARCHAR(150) NOT NULL,
    telephone           VARCHAR(20) NOT NULL UNIQUE,
    email               VARCHAR(150) UNIQUE,
    mot_de_passe_hash   TEXT NOT NULL,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rôle optionnel (phase 5 du cahier des charges) : accès limité à la saisie des paiements
CREATE TABLE comptes.gerants (
    id                  SERIAL PRIMARY KEY,
    bailleur_id         INTEGER NOT NULL REFERENCES comptes.bailleurs(id) ON DELETE CASCADE,
    nom_complet         VARCHAR(150) NOT NULL,
    telephone           VARCHAR(20) NOT NULL UNIQUE,
    mot_de_passe_hash   TEXT NOT NULL,
    actif               BOOLEAN NOT NULL DEFAULT true,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trace qui a fait quoi (donnée financière sensible = jamais anonyme)
CREATE TABLE comptes.journal_actions (
    id              BIGSERIAL PRIMARY KEY,
    acteur_type     VARCHAR(20) NOT NULL CHECK (acteur_type IN ('bailleur', 'gerant')),
    acteur_id       INTEGER NOT NULL,
    action          VARCHAR(100) NOT NULL,
    cible_type      VARCHAR(50),
    cible_id        INTEGER,
    details         JSONB,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_actions_acteur ON comptes.journal_actions (acteur_type, acteur_id);
