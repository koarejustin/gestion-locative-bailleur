-- Photo de profil du bailleur (comme celle du locataire) — affichée à la
-- place de l'initiale dans le rond en haut de l'écran.
ALTER TABLE comptes.bailleurs ADD COLUMN photo_url TEXT;
