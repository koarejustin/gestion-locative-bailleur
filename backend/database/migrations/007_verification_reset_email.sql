-- Vérification d'email (à l'inscription) + récupération de mot de passe par
-- email pour le compte bailleur.
--
-- - email_verifie : passe à true quand le bailleur clique le lien reçu par
--   email juste après son inscription.
-- - verification_token_hash / verification_token_expire : jeton à usage
--   unique (haché, comme un mot de passe) envoyé dans le lien de
--   vérification, valable 24h.
-- - reinitialisation_demandee_le : sert uniquement à limiter les demandes de
--   "mot de passe oublié" répétées (anti-spam simple, pas de jeton à
--   stocker ici car on envoie directement un nouveau mot de passe).

ALTER TABLE comptes.bailleurs
    ADD COLUMN email_verifie                BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN verification_token_hash      VARCHAR(255),
    ADD COLUMN verification_token_expire    TIMESTAMPTZ,
    ADD COLUMN reinitialisation_demandee_le  TIMESTAMPTZ;
