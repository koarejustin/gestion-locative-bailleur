-- L'envoi d'email (code de vérification à la candidature) n'est plus fiable
-- en production, et on ne veut plus bloquer une vraie candidature derrière
-- une étape qui peut échouer silencieusement. Le prospect passe maintenant
-- directement de son identité à la signature — l'email devient un simple
-- contact optionnel, plus une étape de vérification obligatoire.

ALTER TABLE location.candidatures
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN statut SET DEFAULT 'email_verifie';
