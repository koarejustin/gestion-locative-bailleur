-- Schéma "biens" : quartiers, maisons/cours, chambres numérotées, photos
-- Structure pensée pour la réalité du terrain (cour commune / célibatorium),
-- pas pour un modèle d'immeuble classique.

CREATE SCHEMA IF NOT EXISTS biens;

CREATE TABLE biens.quartiers (
    id              SERIAL PRIMARY KEY,
    bailleur_id     INTEGER NOT NULL REFERENCES comptes.bailleurs(id) ON DELETE CASCADE,
    nom             VARCHAR(100) NOT NULL,
    UNIQUE (bailleur_id, nom)
);

CREATE TABLE biens.maisons_cours (
    id                  SERIAL PRIMARY KEY,
    bailleur_id         INTEGER NOT NULL REFERENCES comptes.bailleurs(id) ON DELETE CASCADE,
    quartier_id         INTEGER NOT NULL REFERENCES biens.quartiers(id) ON DELETE RESTRICT,
    nom                 VARCHAR(150) NOT NULL,
    type_bien           VARCHAR(30) NOT NULL DEFAULT 'cour' CHECK (type_bien IN ('cour', 'celibatorium', 'immeuble')),
    adresse_precise     TEXT,
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos de la maison/cour elle-même (demandé en plus des photos de chambre)
CREATE TABLE biens.photos_maison (
    id              SERIAL PRIMARY KEY,
    maison_id       INTEGER NOT NULL REFERENCES biens.maisons_cours(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    ordre           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE biens.chambres (
    id              SERIAL PRIMARY KEY,
    maison_id       INTEGER NOT NULL REFERENCES biens.maisons_cours(id) ON DELETE CASCADE,
    numero_porte    VARCHAR(20) NOT NULL,
    prix_mensuel    NUMERIC(10,0) NOT NULL CHECK (prix_mensuel >= 0),
    statut          VARCHAR(20) NOT NULL DEFAULT 'libre' CHECK (statut IN ('libre', 'reservee', 'occupee')),
    description     TEXT,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (maison_id, numero_porte)
);

CREATE TABLE biens.photos_chambre (
    id              SERIAL PRIMARY KEY,
    chambre_id      INTEGER NOT NULL REFERENCES biens.chambres(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    ordre           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_chambres_statut ON biens.chambres (statut);
