-- Vitrine publique + signature électronique + paiement initié par le locataire.
--
-- Un prospect consulte les unités libres depuis une page publique (pas de
-- connexion requise), candidate sur l'une d'elles, confirme son adresse email
-- (code à usage unique, pas de SMS payant pour l'instant), puis signe
-- électroniquement (nom tapé + case d'acceptation + mot de passe pour son
-- espace locataire) : ça crée directement son compte locataire ET son
-- contrat, et passe l'unité à "occupée" — exactement comme quand le bailleur
-- crée un contrat à la main aujourd'hui.
--
-- La signature électronique ici est une preuve "email confirmé + nom tapé +
-- horodatage + IP", pas une signature manuscrite numérisée ni une vérification
-- d'identité par SMS (ce dernier point reste payant, pas encore activé).

CREATE TABLE location.candidatures (
    id                          SERIAL PRIMARY KEY,
    chambre_id                  INTEGER NOT NULL REFERENCES biens.chambres(id) ON DELETE CASCADE,
    nom_complet                 VARCHAR(150) NOT NULL,
    telephone                   VARCHAR(20) NOT NULL,
    email                       VARCHAR(255) NOT NULL,
    piece_identite_num          VARCHAR(50),
    loyer_mensuel                NUMERIC(10,0) NOT NULL,
    caution_montant              NUMERIC(10,0) NOT NULL DEFAULT 0,
    date_debut_souhaitee         DATE,
    statut                       VARCHAR(20) NOT NULL DEFAULT 'email_a_verifier'
                                 CHECK (statut IN ('email_a_verifier', 'email_verifie', 'signee')),
    code_verification_hash       VARCHAR(255),
    code_verification_expire     TIMESTAMPTZ,
    email_verifie_le             TIMESTAMPTZ,
    signature_nom_saisi          VARCHAR(150),
    signature_ip                 VARCHAR(64),
    signature_user_agent         TEXT,
    signee_le                    TIMESTAMPTZ,
    locataire_id                 INTEGER REFERENCES location.locataires(id) ON DELETE SET NULL,
    contrat_id                   INTEGER REFERENCES location.contrats(id) ON DELETE SET NULL,
    cree_le                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidatures_chambre ON location.candidatures (chambre_id);

-- Sait si un locataire a été créé par le bailleur (à la main, comme avant)
-- ou par une signature électronique en ligne — juste pour affichage/traçabilité,
-- ne change aucune logique de droits d'accès.
ALTER TABLE location.locataires
    ADD COLUMN origine VARCHAR(25) NOT NULL DEFAULT 'manuel'
        CHECK (origine IN ('manuel', 'candidature_en_ligne'));

-- Un versement peut désormais être déclaré par le locataire lui-même (depuis
-- son espace, "j'ai payé depuis mon numéro") plutôt que saisi par le bailleur :
-- dans ce cas il reste "en_attente_confirmation" — il ne compte dans le solde
-- de l'échéance et ne génère de reçu qu'une fois confirmé par le bailleur
-- (qui vérifie la réception réelle sur son propre compte Mobile Money, faute
-- d'accès API direct chez Orange/Moov/Wave pour l'instant).
ALTER TABLE paiements.versements
    ADD COLUMN initiee_par       VARCHAR(15) NOT NULL DEFAULT 'bailleur'
        CHECK (initiee_par IN ('bailleur', 'locataire')),
    ADD COLUMN statut_versement  VARCHAR(25) NOT NULL DEFAULT 'confirme'
        CHECK (statut_versement IN ('confirme', 'en_attente_confirmation', 'rejete')),
    ADD COLUMN numero_expediteur VARCHAR(20);

CREATE INDEX idx_versements_statut ON paiements.versements (statut_versement);
