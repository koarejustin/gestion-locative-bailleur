-- Schéma "paiements" : échéances mensuelles + versements (supporte le paiement en tranches)

CREATE SCHEMA IF NOT EXISTS paiements;

-- Une échéance = un mois dû pour un contrat. Le solde diminue à chaque versement.
CREATE TABLE paiements.echeances (
    id              SERIAL PRIMARY KEY,
    contrat_id      INTEGER NOT NULL REFERENCES location.contrats(id) ON DELETE CASCADE,
    mois            DATE NOT NULL, -- toujours le 1er jour du mois concerné
    montant_du      NUMERIC(10,0) NOT NULL CHECK (montant_du >= 0),
    montant_verse   NUMERIC(10,0) NOT NULL DEFAULT 0 CHECK (montant_verse >= 0),
    statut          VARCHAR(15) NOT NULL DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente', 'partiel', 'a_jour', 'en_retard')),
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contrat_id, mois)
);

CREATE INDEX idx_echeances_statut ON paiements.echeances (statut);
CREATE INDEX idx_echeances_mois ON paiements.echeances (mois);

-- Chaque versement (tranche) réduit le solde de l'échéance correspondante
CREATE TABLE paiements.versements (
    id                      SERIAL PRIMARY KEY,
    echeance_id             INTEGER NOT NULL REFERENCES paiements.echeances(id) ON DELETE CASCADE,
    montant                 NUMERIC(10,0) NOT NULL CHECK (montant > 0),
    methode                 VARCHAR(20) NOT NULL CHECK (methode IN ('orange_money', 'moov_money', 'wave', 'especes')),
    reference_transaction   VARCHAR(100),
    recu_pdf_url            TEXT,
    verse_le                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_versements_echeance ON paiements.versements (echeance_id);
