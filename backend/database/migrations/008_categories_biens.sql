-- Refonte de la catégorisation des biens, pour coller à la réalité du terrain :
-- une "maison/cour" (biens.maisons_cours) a maintenant 4 informations
-- indépendantes plutôt qu'un seul type figé :
--
--   - type_bien   : 'cour' (organisée autour d'une cour commune) ou
--                   'batiment' (immeuble — à l'intérieur d'une cour, ou
--                   autonome, par exemple une rangée de boutiques en
--                   bordure de route)
--   - disposition : 'unique' (toute la propriété = un seul locataire, ex.
--                   une villa entière) ou 'divisee' (plusieurs unités
--                   indépendantes, chacune libre/occupée séparément — ça
--                   couvre célibatorium, immeuble à appartements, et
--                   rangée de boutiques)
--   - usage_bien  : 'habitation' ou 'commerce' (boutique)
--   - style_construction / nombre_etages : étiquettes descriptives libres
--                   (villa, demi-villa, nombre d'étages), affichées sur la
--                   fiche mais qui ne changent aucune logique de statut.
--
-- Les anciennes valeurs de type_bien ('celibatorium', 'immeuble') sont
-- reprojetées sur ce nouveau modèle avant que la contrainte ne soit
-- resserrée, pour que les données déjà saisies restent valides et cohérentes.

ALTER TABLE biens.maisons_cours DROP CONSTRAINT IF EXISTS maisons_cours_type_bien_check;

ALTER TABLE biens.maisons_cours
    ADD COLUMN disposition          VARCHAR(20) NOT NULL DEFAULT 'divisee'
                                     CHECK (disposition IN ('unique', 'divisee')),
    ADD COLUMN usage_bien           VARCHAR(20) NOT NULL DEFAULT 'habitation'
                                     CHECK (usage_bien IN ('habitation', 'commerce')),
    ADD COLUMN style_construction   VARCHAR(20)
                                     CHECK (style_construction IS NULL OR style_construction IN ('villa', 'demi_villa')),
    ADD COLUMN nombre_etages        SMALLINT
                                     CHECK (nombre_etages IS NULL OR nombre_etages >= 0);

-- Un célibatorium ou un immeuble existant est par nature divisé en plusieurs unités.
UPDATE biens.maisons_cours SET disposition = 'divisee' WHERE type_bien IN ('celibatorium', 'immeuble');

-- Une "cour" existante : si elle n'a qu'une seule chambre (ou aucune), on
-- suppose qu'elle est louée comme un tout ; si elle en a plusieurs, elle
-- est déjà de fait "divisée".
UPDATE biens.maisons_cours m
SET disposition = CASE
    WHEN (SELECT COUNT(*) FROM biens.chambres c WHERE c.maison_id = m.id) <= 1 THEN 'unique'
    ELSE 'divisee'
END
WHERE m.type_bien = 'cour';

UPDATE biens.maisons_cours SET type_bien = 'batiment' WHERE type_bien = 'immeuble';
UPDATE biens.maisons_cours SET type_bien = 'cour' WHERE type_bien = 'celibatorium';

ALTER TABLE biens.maisons_cours
    ADD CONSTRAINT maisons_cours_type_bien_check CHECK (type_bien IN ('cour', 'batiment'));
