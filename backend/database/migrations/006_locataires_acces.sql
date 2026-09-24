-- Ajoute la possibilité pour un locataire d'avoir son propre accès (connexion)
-- pour consulter son contrat et ses paiements.
--
-- Le compte n'est PAS créé par le locataire lui-même : c'est le bailleur qui,
-- depuis sa page Locataires, génère un code d'accès à 6 chiffres pour un
-- locataire. Le locataire utilise ensuite son numéro de téléphone + ce code
-- pour se connecter et, à la première connexion, définit son propre mot de passe.

ALTER TABLE location.locataires
    ADD COLUMN mot_de_passe_hash   VARCHAR(255),
    ADD COLUMN code_acces_hash     VARCHAR(255),
    ADD COLUMN code_acces_expire   TIMESTAMPTZ,
    ADD COLUMN compte_actif        BOOLEAN NOT NULL DEFAULT false;

-- Un même numéro de téléphone peut apparaître plusieurs fois (locataires
-- différents chez des bailleurs différents, ou même personne louant deux
-- chambres) : pas de contrainte unique globale. La connexion se fait en
-- comparant le mot de passe sur toutes les lignes correspondant au téléphone.
CREATE INDEX idx_locataires_telephone ON location.locataires (telephone);
