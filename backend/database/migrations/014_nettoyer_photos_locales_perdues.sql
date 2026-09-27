-- Avant ce changement, les photos étaient écrites sur le disque du serveur
-- Render, qui est effacé à chaque nouveau déploiement (offre gratuite) : les
-- fichiers référencés par ces anciennes URLs ("/uploads/...") n'existent
-- plus, ce qui affichait une image cassée. Les photos sont maintenant
-- envoyées vers Supabase Storage (persistant), donc on nettoie les
-- anciennes références mortes plutôt que de laisser des images cassées —
-- il suffira de réuploader les photos concernées.

DELETE FROM biens.photos_maison WHERE url LIKE '/uploads/%';
DELETE FROM biens.photos_chambre WHERE url LIKE '/uploads/%';

UPDATE comptes.bailleurs SET photo_url = NULL WHERE photo_url LIKE '/uploads/%';
UPDATE location.locataires SET photo_url = NULL WHERE photo_url LIKE '/uploads/%';
