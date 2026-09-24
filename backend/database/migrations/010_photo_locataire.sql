-- Permet au locataire de mettre sa propre photo de profil (au lieu de
-- l'icône générique affichée par défaut côté bailleur, dans Locataires.jsx).
-- Le locataire l'ajoute lui-même depuis son espace ; le bailleur ne fait
-- que la voir.

ALTER TABLE location.locataires
    ADD COLUMN photo_url TEXT;
