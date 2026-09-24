# Gestion Locative Bailleur

Application de gestion locative pour un bailleur (cours, célibatoriums, chambres
numérotées) : suivi des loyers, mobile money, cautions, visites.

Voir `cahier-des-charges-gestion-locative.pdf` pour la spécification complète.

## Démarrage du backend

Dans le dossier `backend/` :

1. `npm install`
2. Copier `.env.example` en `.env` et renseigner `DATABASE_URL` (utilisateur/mot de passe de ton PostgreSQL local, ex: `postgres://postgres:TON_MOT_DE_PASSE@localhost:5432/gestion_locative`). Les variables `GMAIL_UTILISATEUR` / `GMAIL_MOT_DE_PASSE_APPLICATION` peuvent rester vides pour développer (voir la section "Vérification d'email" plus bas).
3. Tout créer d'un coup : `npm run setup` (crée la base si elle n'existe pas encore, puis applique les migrations) — plus besoin de passer par psql/pgAdmin à la main
4. Démarrer le serveur : `npm run dev`
5. Vérifier : http://localhost:4000/api/health → `{"ok":true,"db":"connectee"}`

`npm run setup` = `npm run db:create` (crée la base "gestion_locative" si absente) + `npm run migrate` (applique les migrations). Les deux peuvent aussi être lancées séparément.

## Démarrage du frontend

Dans le dossier `frontend/` :

1. `npm install`
2. `npm run dev`
3. Ouvrir http://localhost:5173 → tu arrives sur l'écran de connexion
4. La première fois, clique sur "Créer un compte" pour créer le compte bailleur (nom, téléphone, mot de passe) — c'est ce compte qui protège l'accès à toute l'application via un jeton de connexion (JWT)

## Structure de la base de données

Un schéma PostgreSQL par domaine, comme sur Campus Numérique FASO :

| Schéma          | Contenu                                                            |
|-----------------|---------------------------------------------------------------------|
| `comptes`       | Bailleurs, gérants/collecteurs, journal des actions                |
| `biens`         | Quartiers, maisons/cours, chambres numérotées, photos              |
| `location`      | Locataires, contrats (loyer + caution), états des lieux, visites   |
| `paiements`     | Échéances mensuelles, versements (permet le paiement en tranches)  |
| `notifications` | Préférences de rappel, historique des envois (SMS/WhatsApp/push)   |

Chaque fichier de `backend/database/migrations/` correspond à un schéma et peut
être relu indépendamment pour comprendre les tables et leurs relations.

## Où en est l'application

- **Authentification** : compte bailleur (inscription/connexion), jeton JWT, toutes
  les routes `/api/biens/*` protégées.
- **Module `biens`** : branché de bout en bout — routes API (`backend/src/routes/biens.routes.js`)
  + page React `Biens.jsx` (créer/modifier/supprimer un quartier, une maison/cour,
  une chambre, avec les prix et le statut libre/réservée/occupée).
  - **Catégorisation d'une maison/cour** : 4 informations indépendantes plutôt
    qu'un seul type figé, pour coller à la réalité du terrain (cour unique,
    célibatorium, immeuble à appartements, rangée de boutiques en bordure de
    route...) :
    - **Type de bien** : `Cour` (organisée autour d'une cour commune) ou
      `Bâtiment` (immeuble — à l'intérieur d'une cour, ou autonome, par
      exemple une rangée de boutiques).
    - **Disposition** : `Unique` (toute la propriété = un seul locataire,
      ex. une villa entière) ou `Divisée` (plusieurs unités indépendantes,
      chacune libre/réservée/occupée séparément — célibatorium, immeuble à
      appartements, rangée de boutiques).
    - **Usage** : `Habitation` ou `Commerce` (boutique) — change le
      vocabulaire affiché partout dans l'application (« Boutique » au lieu
      de « Chambre », « Numéro de boutique » au lieu de « Numéro de porte »).
    - **Style / nombre d'étages** (optionnel) : villa, demi-villa, nombre
      d'étages — de simples étiquettes descriptives affichées sur la fiche.
    - Les données déjà saisies avant cette mise à jour (anciens types
      `celibatorium`/`immeuble`) sont automatiquement reprojetées sur ce
      nouveau modèle par la migration — rien à ressaisir.
  - **Détail par porte/unité et équipements libres** : pour un célibatorium
    ou un bâtiment à étages, le détail de chaque porte ne se limitait pas à
    un prix — on peut maintenant préciser, par porte : le **nombre de
    chambres**, l'**étage** (RDC, 1er étage...), et une liste **libre**
    d'équipements (salon, cuisine, douche interne, salle à manger... ou
    n'importe quel autre mot tapé à la main). La maison/cour elle-même a sa
    propre liste d'équipements (piscine, parking, cour clôturée...). Les
    suggestions affichées ne sont que des raccourcis cliquables — rien n'est
    figé, aucune information n'est obligatoire.
  - **Créer plusieurs portes d'un coup** : bouton "+ Plusieurs portes" (ou
    "+ Plusieurs boutiques") sur une maison/cour — au lieu de créer chaque
    porte une par une, on choisit un préfixe (ex. "A"), un numéro de départ
    et une quantité, et toutes les portes sont créées avec la même
    numérotation automatique (A1, A2, A3...), le même prix, et le même
    détail (nombre de chambres/étage/équipements) en une seule opération. Un
    aperçu des numéros générés s'affiche avant de valider, et un message
    clair prévient si un des numéros existe déjà (rien n'est créé en
    silence).
  - **Photos** : une maison/cour peut avoir plusieurs photos (vue d'ensemble),
    et chaque chambre/boutique peut en plus avoir sa/ses propres photos
    (`biens.photos_chambre`, upload/suppression via le formulaire de
    modification d'une chambre) — utile dans un bâtiment où les unités ne se
    ressemblent pas. Si une chambre n'a pas sa propre photo, celle de la
    maison/cour est utilisée à la place, aussi bien sur cette page que sur la
    vitrine publique et l'espace locataire. La page Biens affiche maintenant
    un petit texte d'introduction sur l'organisation quartier → maison/cour →
    chambre, et une aide contextuelle sous les champs Type/Disposition/Usage/
    Style.
  - **Suppressions** : confirmées par une fenêtre intégrée à l'application
    (plus de popup natif du navigateur) sur Biens, Locataires et Paiements —
    composant réutilisable `frontend/src/components/ui/ConfirmerModal.jsx`.
- **Module `location`** : branché de bout en bout — routes API
  (`backend/src/routes/location.routes.js`) + page React `Locataires.jsx`.
  - Le bailleur enregistre un locataire, lui crée un contrat sur une chambre
    libre (loyer, échéance, caution) — la chambre passe automatiquement à
    "occupée", et redevient "libre" quand le contrat est terminé.
  - **Espace locataire** : le bailleur génère, depuis la fiche du locataire,
    un code d'accès à 6 chiffres à lui transmettre. Le locataire va sur
    `/locataire/activer`, entre son téléphone + ce code, choisit son propre
    mot de passe, et arrive directement sur son espace (`/locataire`). Il y
    voit son logement (avec photo si disponible), la situation du mois (à
    jour / partiel / en retard), son loyer et sa caution, les coordonnées de
    son bailleur, et l'historique complet de ses paiements avec le lien vers
    chaque reçu PDF. Compte et mot de passe entièrement séparés de ceux du
    bailleur (stockage local distinct côté frontend, jeton JWT avec
    `role: "locataire"` côté backend — un jeton locataire ne peut pas accéder
    aux routes bailleur, et inversement).
  - **Photo de profil du locataire** : depuis son espace (`/locataire`), le
    locataire peut mettre (et retirer) sa propre photo — elle remplace alors
    l'icône générique sur sa fiche côté bailleur (page Locataires).
- **Module `paiements`** : branché de bout en bout — routes API
  (`backend/src/routes/paiements.routes.js`, logique de calcul du statut dans
  `backend/src/services/echeances.js`) + page React `Paiements.jsx`.
  - Une échéance mensuelle est générée automatiquement pour chaque contrat actif
    (pas de tâche cron nécessaire — elle est créée à la volée dès qu'on la consulte).
  - Le loyer peut être payé **en plusieurs tranches** (versements) : chaque
    versement enregistre le montant, le moyen de paiement (Orange Money, Moov
    Money, Wave, Espèces), une référence de transaction optionnelle, et l'heure
    exacte (à la seconde).
  - Le statut (à jour / partiel / en retard / en attente) est recalculé
    automatiquement à partir du montant versé, du jour d'échéance et de la
    marge de tolérance du contrat.
  - La page Paiements liste les échéances du mois avec le statut de chaque
    locataire, et l'historique complet des transactions (date/heure, montant,
    moyen, référence). Navigation mois précédent/suivant.
- **Tableau de bord** : nettoyé des messages techniques internes (plus de
  "État du serveur backend" visible par le bailleur). Les 4 indicateurs sont
  maintenant de vrais chiffres calculés (chambres occupées/libres, loyers en
  retard, encaissé ce mois) et **cliquables** — ils renvoient vers la page
  détaillée correspondante (Locataires, Biens ou Paiements).
- **Caution** : montant et statut (détenue / restituée totale / restituée
  partielle / retenue) enregistrés à la création du contrat et modifiables
  quand le contrat se termine.
- **Reçu de paiement automatique** : chaque versement génère un reçu PDF
  (bailleur, locataire, logement, montant, moyen de paiement, référence,
  date/heure précise, situation du mois) via `pdfkit`
  (`backend/src/services/recus.js`). Le reçu est servi depuis `/uploads/recus/`
  comme les photos — pas besoin d'être connecté pour l'ouvrir, donc facile à
  partager (WhatsApp, SMS...). Bouton "📄 Voir le reçu" sur chaque ligne de la
  page Paiements.
- **Vérification d'email et mot de passe oublié (compte bailleur)** :
  - À l'inscription, si un email est renseigné, un lien de vérification est
    envoyé automatiquement. Tant qu'il n'est pas cliqué, une bannière discrète
    apparaît sur le tableau de bord (avec un bouton pour renvoyer l'email).
  - "Mot de passe oublié ?" sur l'écran de connexion : le bailleur entre son
    email **vérifié**, reçoit un nouveau mot de passe temporaire par email, et
    peut se reconnecter avec.
  - La récupération par numéro de téléphone (SMS) n'est pas encore activée —
    la plupart des fournisseurs SMS sont payants dès le premier message ;
    ça attend que tu sois prêt à créer et financer ce genre de compte.
  - **Important** : tant que `GMAIL_UTILISATEUR` / `GMAIL_MOT_DE_PASSE_APPLICATION`
    ne sont pas renseignés dans `backend/.env`, aucun email n'est réellement
    envoyé (juste écrit dans les logs du serveur — pratique pour tester sans
    compte Gmail). Voir `backend/.env.example` pour la marche à suivre
    (compte Gmail + "mot de passe d'application", gratuit, ~2 minutes à créer).
- **Vitrine publique + candidature + signature électronique** : les prospects
  n'ont plus besoin de passer par le bailleur pour découvrir ce qui est
  disponible.
  - `/louer` — page publique (aucune connexion requise) qui liste toutes les
    chambres/boutiques **libres**, avec photos, prix et filtres (usage,
    quartier). Un bouton "Copier le lien"/"Ouvrir" est disponible sur le
    tableau de bord du bailleur pour le partager facilement.
  - En cliquant sur une unité, le prospect candidate en 3 étapes : (1) ses
    informations (nom, téléphone, email, CNIB optionnel), (2) confirmation
    par un code à 6 chiffres envoyé par email (pas de SMS payant pour
    l'instant), (3) signature électronique — il tape son nom complet, coche
    une case d'acceptation, et choisit son mot de passe. La signature crée
    **directement** son compte locataire (actif) et son contrat, passe
    l'unité à "occupée", et le connecte automatiquement à son espace
    locataire (`/locataire`) — comme si le bailleur avait fait le contrat à
    la main. La signature elle-même (nom tapé + email confirmé + IP +
    horodatage) est enregistrée dans `location.candidatures` pour garder une
    trace, et la fiche du locataire porte un badge "Signé en ligne" sur la
    page Locataires.
  - **Limite actuelle, assumée** : il n'y a pas de vérification d'identité
    par SMS (payant, désactivé pour l'instant) — la preuve d'identité repose
    sur l'email confirmé et le nom tapé. Si besoin, le contrat peut toujours
    être terminé manuellement comme n'importe quel autre depuis la page
    Locataires.
- **Paiement déclaré par le locataire (Mobile Money)** : depuis son espace
  (`/locataire`), le locataire peut cliquer sur "J'ai payé depuis mon
  numéro" après avoir envoyé la somme lui-même vers le compte Mobile Money
  du bailleur (Orange Money, Moov Money ou Wave). Ça crée un paiement
  **"en attente de confirmation"** — il ne compte pas encore dans son solde
  et ne génère pas de reçu. Le bailleur voit ces paiements en attente en
  haut de la page Paiements, vérifie la réception sur son propre compte, et
  clique "Confirmer" (ou "Rien reçu" si rien n'est arrivé) — la confirmation
  applique enfin le montant et génère le reçu comme un paiement classique.
  - **Pourquoi pas un vrai prélèvement automatique** : ça demande un accès
    API développeur (identifiants d'intégration) chez Orange Money / Moov
    Money / Wave, différent du compte marchand classique qui sert aux
    dépôts. Le circuit ci-dessus est prêt à recevoir cette automatisation
    dès que ces accès seront en main — en attendant, la confirmation reste
    manuelle, comme le paiement en espèces aujourd'hui.

## Avant un vrai déploiement (effacer les données de test)

Après avoir testé l'application (comptes, quartiers, locataires... créés pendant
les essais), tu peux tout remettre à zéro sans toucher au schéma de la base
(pas besoin de refaire les migrations après) :

```
npm run reset-donnees              # aperçu seulement, ne supprime rien
npm run reset-donnees:confirmer    # supprime réellement tout (comptes, biens,
                                    # locataires, contrats, paiements, photos)
```

Après ça, l'application est vide et prête pour le premier vrai compte bailleur
(ton client). Les identifiants (id) redémarrent à 1.

## Prochaine étape

Tous les modules prévus au départ (biens, location, paiements, espace
locataire, reçus, vérification d'email, vitrine publique + signature
électronique, paiement déclaré par le locataire) sont maintenant branchés de
bout en bout. Pistes possibles pour la suite, qui dépendent de démarches
externes que je ne peux pas faire à ta place :
- **SMS de vérification** pour la signature électronique et la récupération
  de mot de passe — nécessite un compte payant chez un fournisseur SMS.
- **Vrai prélèvement automatique Mobile Money** — nécessite un accès API
  développeur chez Orange Money / Moov Money / Wave (différent du compte
  marchand classique) ; en attendant, la confirmation des paiements déclarés
  par les locataires reste manuelle (voir plus haut).
- Notifications de rappel de loyer, ou tout ce que le retour de ton client
  fera remonter une fois l'application en vraies mains.
