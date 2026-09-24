-- Schéma "notifications" : préférences de rappel + historique des envois

CREATE SCHEMA IF NOT EXISTS notifications;

CREATE TABLE notifications.preferences_rappel (
    bailleur_id             INTEGER PRIMARY KEY REFERENCES comptes.bailleurs(id) ON DELETE CASCADE,
    jours_avant_echeance    SMALLINT[] NOT NULL DEFAULT '{3,1}',
    jours_tolerance         SMALLINT NOT NULL DEFAULT 3
);

CREATE TABLE notifications.envois (
    id              BIGSERIAL PRIMARY KEY,
    contrat_id      INTEGER NOT NULL REFERENCES location.contrats(id) ON DELETE CASCADE,
    type_envoi      VARCHAR(20) NOT NULL CHECK (type_envoi IN ('rappel_avant', 'relance_retard', 'confirmation_paiement')),
    canal           VARCHAR(20) NOT NULL CHECK (canal IN ('sms', 'whatsapp', 'push')),
    contenu         TEXT NOT NULL,
    statut          VARCHAR(15) NOT NULL DEFAULT 'envoye' CHECK (statut IN ('envoye', 'echec')),
    envoye_le       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_envois_contrat ON notifications.envois (contrat_id);
