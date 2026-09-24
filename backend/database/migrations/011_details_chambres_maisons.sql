-- Ajoute le détail demandé par le bailleur pour chaque porte/unité (un
-- célibatorium ou un bâtiment ne sont pas tous composés de simples chambres
-- nues : certaines portes ont un salon, une douche interne, une cuisine...)
-- et pour la maison/cour elle-même (piscine, parking...). Volontairement
-- "libre" (tableau de texte, pas une liste figée) : le bailleur choisit
-- parmi des suggestions courantes dans l'interface, mais peut aussi taper
-- n'importe quoi d'autre.

ALTER TABLE biens.chambres
    ADD COLUMN nombre_chambres  SMALLINT,
    ADD COLUMN etage            VARCHAR(30),
    ADD COLUMN equipements      TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE biens.maisons_cours
    ADD COLUMN equipements      TEXT[] NOT NULL DEFAULT '{}';
