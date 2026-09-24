-- Schéma "location" : locataires, contrats, états des lieux, visites/réservations

CREATE SCHEMA IF NOT EXISTS location;

CREATE TABLE location.locataires (
    id                  SERIAL PRIMARY KEY,
    bailleur_id         INTEGER NOT NULL REFERENCES comptes.bailleurs(id) ON DELETE CASCADE,
    nom_complet         VARCHAR(150) NOT NULL,
    telephone           VARCHAR(20) NOT NULL,
    piece_identite_num  VARCHAR(50),
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Le contrat porte le loyer, l'échéance et la caution : une chambre peut avoir
-- plusieurs contrats dans le temps (locataires successifs), mais un seul actif à la fois.
CREATE TABLE location.contrats (
    id                      SERIAL PRIMARY KEY,
    chambre_id              INTEGER NOT NULL REFERENCES biens.chambres(id) ON DELETE RESTRICT,
    locataire_id            INTEGER NOT NULL REFERENCES location.locataires(id) ON DELETE RESTRICT,
    loyer_mensuel           NUMERIC(10,0) NOT NULL CHECK (loyer_mensuel >= 0),
    jour_echeance           SMALLINT NOT NULL DEFAULT 5 CHECK (jour_echeance BETWEEN 1 AND 28),
    marge_tolerance_jours   SMALLINT NOT NULL DEFAULT 3,
    caution_montant         NUMERIC(10,0) NOT NULL DEFAULT 0,
    caution_statut          VARCHAR(20) NOT NULL DEFAULT 'detenue'
                            CHECK (caution_statut IN ('detenue', 'restituee_totale', 'restituee_partielle', 'retenue')),
    date_debut              DATE NOT NULL,
    date_fin                DATE,
    actif                   BOOLEAN NOT NULL DEFAULT true,
    cree_le                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrats_chambre ON location.contrats (chambre_id);
CREATE INDEX idx_contrats_locataire ON location.contrats (locataire_id);
-- Un seul contrat actif par chambre à la fois (protection au niveau base de données)
CREATE UNIQUE INDEX idx_contrats_chambre_actif ON location.contrats (chambre_id) WHERE actif = true;

-- Photos + note à l'entrée et à la sortie, pour éviter les litiges sur la caution
CREATE TABLE location.etats_des_lieux (
    id              SERIAL PRIMARY KEY,
    contrat_id      INTEGER NOT NULL REFERENCES location.contrats(id) ON DELETE CASCADE,
    type_etat       VARCHAR(10) NOT NULL CHECK (type_etat IN ('entree', 'sortie')),
    photo_url       TEXT,
    note            TEXT,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un prospect demande à visiter une chambre libre avant de s'engager
CREATE TABLE location.visites (
    id                  SERIAL PRIMARY KEY,
    chambre_id          INTEGER NOT NULL REFERENCES biens.chambres(id) ON DELETE CASCADE,
    prospect_nom        VARCHAR(150) NOT NULL,
    prospect_telephone  VARCHAR(20) NOT NULL,
    date_souhaitee      TIMESTAMPTZ,
    statut              VARCHAR(20) NOT NULL DEFAULT 'demandee'
                        CHECK (statut IN ('demandee', 'planifiee', 'effectuee', 'annulee')),
    cree_le             TIMESTAMPTZ NOT NULL DEFAULT now()
);
