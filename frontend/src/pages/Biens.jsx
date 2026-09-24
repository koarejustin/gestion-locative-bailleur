import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmerModal from "../components/ui/ConfirmerModal.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Champ, {
  styleEntree,
  styleBoutonPrimaire,
  styleBoutonSecondaire,
  styleBoutonTexte,
} from "../components/ui/Champ.jsx";

const TYPES_BIEN = [
  { valeur: "cour", label: "Cour" },
  { valeur: "batiment", label: "Bâtiment" },
];

const DISPOSITIONS = [
  { valeur: "unique", label: "Unique — un seul locataire pour tout" },
  { valeur: "divisee", label: "Divisée en plusieurs unités" },
];

const USAGES_BIEN = [
  { valeur: "habitation", label: "Habitation" },
  { valeur: "commerce", label: "Commerce (boutique)" },
];

const STYLES_CONSTRUCTION = [
  { valeur: "", label: "— Aucun —" },
  { valeur: "villa", label: "Villa" },
  { valeur: "demi_villa", label: "Demi-villa" },
];

const DISPOSITION_LABEL = Object.fromEntries(DISPOSITIONS.map((d) => [d.valeur, d.label]));
const USAGE_LABEL = Object.fromEntries(USAGES_BIEN.map((u) => [u.valeur, u.label]));
const STYLE_LABEL = { villa: "Villa", demi_villa: "Demi-villa" };

const STATUT_BADGE = { libre: "neutre", reservee: "attention", occupee: "ok" };
const STATUT_LABEL = { libre: "Libre", reservee: "Réservée", occupee: "Occupée" };

const STATUT_PAIEMENT_BADGE = { a_jour: "ok", partiel: "attention", en_retard: "erreur", en_attente: "neutre" };
const STATUT_PAIEMENT_LABEL = {
  a_jour: "Loyer à jour",
  partiel: "Paiement partiel",
  en_retard: "Loyer en retard",
  en_attente: "En attente",
};

// Suggestions courantes — la liste n'est pas fermée : le bailleur peut aussi
// taper n'importe quel autre équipement dans le champ libre à côté.
const SUGGESTIONS_EQUIPEMENTS_MAISON = [
  "Piscine",
  "Parking",
  "Cour clôturée",
  "Générateur",
  "Eau courante",
];
const SUGGESTIONS_EQUIPEMENTS_CHAMBRE = [
  "Salon",
  "Cuisine",
  "Douche interne",
  "Salle à manger",
];

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

// Liste "libre" d'équipements : des suggestions cliquables (toggle), plus un
// champ pour taper n'importe quoi d'autre — le bailleur n'est jamais limité
// à une liste figée.
function ChoixEquipements({ suggestions, valeurs, onChange }) {
  const [nouveau, setNouveau] = useState("");

  function basculer(tag) {
    onChange(valeurs.includes(tag) ? valeurs.filter((v) => v !== tag) : [...valeurs, tag]);
  }

  function ajouterPersonnalise() {
    const t = nouveau.trim();
    if (t && !valeurs.includes(t)) onChange([...valeurs, t]);
    setNouveau("");
  }

  const personnalises = valeurs.filter((v) => !suggestions.includes(v));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {suggestions.map((s) => {
          const actif = valeurs.includes(s);
          return (
            <button
              type="button"
              key={s}
              onClick={() => basculer(s)}
              className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                actif
                  ? "bg-[#1F3A5F] border-[#1F3A5F] text-white"
                  : "border-slate-300 text-slate-600 hover:border-[#1F3A5F]"
              }`}
            >
              {actif ? "✓ " : "+ "}
              {s}
            </button>
          );
        })}
        {personnalises.map((p) => (
          <button
            type="button"
            key={p}
            onClick={() => basculer(p)}
            className="text-xs rounded-full border border-[#1F3A5F] bg-[#1F3A5F] text-white px-2.5 py-1"
          >
            ✓ {p} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={styleEntree}
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder="Autre équipement..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouterPersonnalise();
            }
          }}
        />
        <button type="button" className={styleBoutonSecondaire} onClick={ajouterPersonnalise}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

// Comme `Champ`, mais avec un <div> à la place d'un <label> : ce champ
// contient plusieurs boutons (ChoixEquipements), pas un seul contrôle de
// formulaire, donc un <label> autour rendrait le nom accessible de chaque
// bouton ambigu (le navigateur mélange le texte du label avec celui des
// boutons).
function ChampEquipements({ label, children }) {
  return (
    <div className="block mb-3">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </div>
  );
}

export default function Biens() {
  const [quartiers, setQuartiers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [modalQuartier, setModalQuartier] = useState(null);
  const [modalMaison, setModalMaison] = useState(null);
  const [modalChambre, setModalChambre] = useState(null);
  const [modalLot, setModalLot] = useState(null); // { maisonId, usageBien }
  const [confirmation, setConfirmation] = useState(null); // { message, action }
  const [confirmationEnCours, setConfirmationEnCours] = useState(false);

  async function executerConfirmation() {
    if (!confirmation) return;
    setConfirmationEnCours(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
      setConfirmation(null);
    } finally {
      setConfirmationEnCours(false);
    }
  }

  const stats = useMemo(() => {
    const maisons = quartiers.flatMap((q) => q.maisons);
    const chambres = maisons.flatMap((m) => m.chambres);
    const occupees = chambres.filter((c) => c.statut === "occupee").length;
    const tauxOccupation = chambres.length
      ? `${Math.round((occupees / chambres.length) * 100)}%`
      : "—";
    return {
      quartiers: quartiers.length,
      maisons: maisons.length,
      chambres: chambres.length,
      tauxOccupation,
    };
  }, [quartiers]);

  // `silencieux` évite l'écran "Chargement des biens..." (qui remplace toute
  // la page, donc démonte au passage tout formulaire/modale ouvert et perd
  // son état local) — utilisé pour les rafraîchissements en arrière-plan
  // déclenchés depuis un formulaire encore ouvert (ex. après l'ajout d'une
  // photo), où seul le premier chargement de la page doit passer par cet
  // écran.
  async function charger({ silencieux = false } = {}) {
    if (!silencieux) setChargement(true);
    try {
      const { data } = await api.get("/biens");
      setQuartiers(data.quartiers);
      setErreur("");
    } catch {
      setErreur("Impossible de charger les biens pour le moment.");
    } finally {
      if (!silencieux) setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function demanderSuppressionQuartier(quartier) {
    setErreur("");
    setConfirmation({
      message: `Supprimer le quartier "${quartier.nom}" ? Ça n'est possible que s'il ne contient plus aucune maison/cour.`,
      action: async () => {
        await api.delete(`/biens/quartiers/${quartier.id}`);
        charger({ silencieux: true });
      },
    });
  }

  function demanderSuppressionMaison(maison) {
    setErreur("");
    setConfirmation({
      message: `Supprimer "${maison.nom}" ? Toutes ses chambres/boutiques et leurs photos seront supprimées aussi.`,
      action: async () => {
        await api.delete(`/biens/maisons/${maison.id}`);
        charger({ silencieux: true });
      },
    });
  }

  function demanderSuppressionChambre(chambre) {
    setErreur("");
    setConfirmation({
      message: `Supprimer "${chambre.numero_porte}" ?`,
      action: async () => {
        await api.delete(`/biens/chambres/${chambre.id}`);
        charger({ silencieux: true });
      },
    });
  }

  if (chargement) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Chargement des biens...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {erreur && (
        <Card className="border-rose-200 bg-rose-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-rose-700">{erreur}</p>
            <button className={styleBoutonSecondaire} onClick={charger}>
              Réessayer
            </button>
          </div>
        </Card>
      )}

      {quartiers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Quartiers" valeur={stats.quartiers} delai={0} />
          <StatCard label="Maisons / cours" valeur={stats.maisons} delai={0.05} />
          <StatCard label="Chambres" valeur={stats.chambres} delai={0.1} />
          <StatCard
            label="Taux d'occupation"
            valeur={stats.tauxOccupation}
            delai={0.15}
            accent="#2E7D32"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {quartiers.length} quartier{quartiers.length > 1 ? "s" : ""}
        </p>
        <button className={styleBoutonPrimaire} onClick={() => setModalQuartier({ mode: "creer" })}>
          + Ajouter un quartier
        </button>
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <p className="text-sm text-slate-600">
          <strong>Comment c'est organisé :</strong> un <strong>quartier</strong> contient une ou
          plusieurs <strong>maisons/cours</strong>. Deux cas selon la <strong>disposition</strong>{" "}
          choisie :
        </p>
        <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc list-inside">
          <li>
            <strong>Divisée</strong> (une cour ou un bâtiment loué par portes) : chaque maison/cour
            contient plusieurs <strong>chambres ou boutiques</strong> (les unités qu'on loue), à
            créer une par une. Exemple : <em>Gampela</em> (quartier) → <em>Cour Zongo</em>{" "}
            (maison/cour) → <em>Porte A1, Porte A2...</em> (chambres).
          </li>
          <li>
            <strong>Unique</strong> (ex. une villa entière louée à un seul locataire) : pas besoin
            de créer de chambre — une seule photo et un seul prix suffisent, l'unité est créée
            automatiquement.
          </li>
        </ul>
      </Card>

      {quartiers.length === 0 && !erreur && (
        <Card>
          <p className="text-sm text-slate-500">
            Aucun quartier pour l'instant. Commence par en ajouter un, puis ajoute les
            maisons/cours et leurs chambres à l'intérieur.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {quartiers.map((quartier) => (
            <QuartierCard
              key={quartier.id}
              quartier={quartier}
              onModifier={() => setModalQuartier({ mode: "modifier", quartier })}
              onSupprimer={() => demanderSuppressionQuartier(quartier)}
              onAjouterMaison={() => setModalMaison({ mode: "creer", quartierId: quartier.id })}
              onModifierMaison={(maison) =>
                setModalMaison({ mode: "modifier", quartierId: quartier.id, maison })
              }
              onSupprimerMaison={demanderSuppressionMaison}
              onAjouterChambre={(maisonId, usageBien) =>
                setModalChambre({ mode: "creer", maisonId, usageBien })
              }
              onAjouterLotChambres={(maisonId, usageBien) => setModalLot({ maisonId, usageBien })}
              onModifierChambre={(maisonId, chambre, usageBien) =>
                setModalChambre({ mode: "modifier", maisonId, chambre, usageBien })
              }
              onSupprimerChambre={demanderSuppressionChambre}
              onRecharger={() => charger({ silencieux: true })}
            />
          ))}
        </AnimatePresence>
      </div>

      <Modal
        ouvert={!!modalQuartier}
        onFermer={() => setModalQuartier(null)}
        titre={modalQuartier?.mode === "modifier" ? "Modifier le quartier" : "Nouveau quartier"}
      >
        {modalQuartier && (
          <QuartierForm
            initial={modalQuartier.quartier}
            onAnnuler={() => setModalQuartier(null)}
            onEnregistre={() => {
              setModalQuartier(null);
              charger({ silencieux: true });
            }}
          />
        )}
      </Modal>

      <Modal
        ouvert={!!modalMaison}
        onFermer={() => setModalMaison(null)}
        titre={modalMaison?.mode === "modifier" ? "Modifier la maison/cour" : "Nouvelle maison/cour"}
      >
        {modalMaison && (
          <MaisonForm
            quartierId={modalMaison.quartierId}
            initial={modalMaison.maison}
            onAnnuler={() => setModalMaison(null)}
            onEnregistre={() => {
              setModalMaison(null);
              charger({ silencieux: true });
            }}
            onPhotosChangees={() => charger({ silencieux: true })}
          />
        )}
      </Modal>

      <Modal
        ouvert={!!modalChambre}
        onFermer={() => setModalChambre(null)}
        titre={
          modalChambre?.usageBien === "commerce"
            ? modalChambre?.mode === "modifier"
              ? "Modifier la boutique"
              : "Nouvelle boutique"
            : modalChambre?.mode === "modifier"
              ? "Modifier la chambre"
              : "Nouvelle chambre"
        }
      >
        {modalChambre && (
          <ChambreForm
            maisonId={modalChambre.maisonId}
            usageBien={modalChambre.usageBien}
            initial={modalChambre.chambre}
            onAnnuler={() => setModalChambre(null)}
            onEnregistre={() => {
              setModalChambre(null);
              charger({ silencieux: true });
            }}
          />
        )}
      </Modal>

      <Modal
        ouvert={!!modalLot}
        onFermer={() => setModalLot(null)}
        titre={modalLot?.usageBien === "commerce" ? "Créer plusieurs boutiques" : "Créer plusieurs portes"}
      >
        {modalLot && (
          <LotChambresForm
            maisonId={modalLot.maisonId}
            usageBien={modalLot.usageBien}
            onAnnuler={() => setModalLot(null)}
            onEnregistre={() => {
              setModalLot(null);
              charger({ silencieux: true });
            }}
          />
        )}
      </Modal>

      <ConfirmerModal
        ouvert={!!confirmation}
        titre="Confirmer la suppression"
        message={confirmation?.message}
        texteConfirmer="Supprimer"
        dangereux
        enCours={confirmationEnCours}
        onAnnuler={() => setConfirmation(null)}
        onConfirmer={executerConfirmation}
      />
    </div>
  );
}

function QuartierCard({
  quartier,
  onModifier,
  onSupprimer,
  onAjouterMaison,
  onModifierMaison,
  onSupprimerMaison,
  onAjouterChambre,
  onAjouterLotChambres,
  onModifierChambre,
  onSupprimerChambre,
  onRecharger,
}) {
  const [ouvert, setOuvert] = useState(true);
  const nbChambres = quartier.maisons.reduce((s, m) => s + m.chambres.length, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
          <button className="flex items-center gap-2 text-left" onClick={() => setOuvert((o) => !o)}>
            <span
              className="text-slate-400 transition-transform inline-block"
              style={{ transform: ouvert ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            <span className="font-semibold text-slate-800">{quartier.nom}</span>
            <span className="text-xs text-slate-400">
              {quartier.maisons.length} maison/cour{quartier.maisons.length > 1 ? "s" : ""} ·{" "}
              {nbChambres} chambre{nbChambres > 1 ? "s" : ""}
            </span>
          </button>
          <div className="flex items-center gap-3">
            <button className={styleBoutonTexte} onClick={onAjouterMaison}>
              + Maison/cour
            </button>
            <button className={styleBoutonTexte} onClick={onModifier}>
              Modifier
            </button>
            <button className="text-xs font-medium text-rose-500 hover:text-rose-600" onClick={onSupprimer}>
              Supprimer
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {ouvert && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-5 space-y-4">
                {quartier.maisons.length === 0 && (
                  <p className="text-sm text-slate-400">Aucune maison/cour dans ce quartier.</p>
                )}
                {quartier.maisons.map((maison) => (
                  <MaisonCard
                    key={maison.id}
                    maison={maison}
                    onModifier={() => onModifierMaison(maison)}
                    onSupprimer={() => onSupprimerMaison(maison)}
                    onAjouterChambre={() => onAjouterChambre(maison.id, maison.usage_bien)}
                    onAjouterLotChambres={() => onAjouterLotChambres(maison.id, maison.usage_bien)}
                    onModifierChambre={(chambre) => onModifierChambre(maison.id, chambre, maison.usage_bien)}
                    onSupprimerChambre={onSupprimerChambre}
                    onRecharger={onRecharger}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

const ICONE_TYPE_BIEN = { cour: "🏡", batiment: "🏢" };

function iconeMaison(maison) {
  if (maison.usage_bien === "commerce") return "🏪";
  return ICONE_TYPE_BIEN[maison.type_bien] || "🏠";
}

function MaisonCard({
  maison,
  onModifier,
  onSupprimer,
  onAjouterChambre,
  onAjouterLotChambres,
  onModifierChambre,
  onSupprimerChambre,
  onRecharger,
}) {
  const typeLabel = TYPES_BIEN.find((t) => t.valeur === maison.type_bien)?.label || maison.type_bien;
  const nbOccupees = maison.chambres.filter((c) => c.statut === "occupee").length;
  const couverture = maison.photos?.[0];
  // "Unique" = toute la maison/cour est louée à un seul locataire (ex. une
  // villa entière) : une seule unité existe en interne pour que le contrat
  // puisse s'y rattacher, mais il n'y a pas de "portes" à gérer une par une.
  const uniteUnique = maison.disposition === "unique" ? maison.chambres[0] : null;

  const etiquettes = [
    typeLabel,
    STYLE_LABEL[maison.style_construction],
    maison.nombre_etages ? `${maison.nombre_etages} étage${maison.nombre_etages > 1 ? "s" : ""}` : null,
    DISPOSITION_LABEL[maison.disposition],
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="relative h-44 bg-slate-100">
        {couverture ? (
          <img
            src={couverture.url}
            alt={`Couverture de ${maison.nom}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-5xl text-slate-300">
            {iconeMaison(maison)}
          </div>
        )}
        {maison.usage_bien === "commerce" && (
          <span className="absolute top-2.5 left-2.5">
            <Badge type="attention">Commerce</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/60">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">{maison.nom}</p>
          <p className="text-xs text-slate-500">
            {etiquettes.join(" · ")}
            {maison.adresse_precise ? ` · ${maison.adresse_precise}` : ""}
          </p>
          {uniteUnique ? (
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{formaterFcfa(uniteUnique.prix_mensuel)}/mois</span>
              <Badge type={STATUT_BADGE[uniteUnique.statut]}>{STATUT_LABEL[uniteUnique.statut]}</Badge>
              {uniteUnique.statut_paiement && (
                <Badge type={STATUT_PAIEMENT_BADGE[uniteUnique.statut_paiement]}>
                  {STATUT_PAIEMENT_LABEL[uniteUnique.statut_paiement]}
                </Badge>
              )}
              <button
                className="text-slate-400 hover:text-[#1F3A5F] underline decoration-dotted"
                onClick={() => onModifierChambre(maison.id, uniteUnique, maison.usage_bien)}
              >
                Modifier le prix
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">
              {maison.chambres.length} unité{maison.chambres.length > 1 ? "s" : ""} · {nbOccupees}{" "}
              occupée{nbOccupees > 1 ? "s" : ""}
            </p>
          )}
          {maison.equipements?.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {maison.equipements.map((e) => (
                <span key={e} className="inline-block bg-white border border-slate-200 rounded-full px-2 py-0.5 mr-1 mb-1">
                  {e}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!uniteUnique && (
            <>
              <button className={styleBoutonTexte} onClick={onAjouterChambre}>
                + {maison.usage_bien === "commerce" ? "Boutique" : "Chambre"}
              </button>
              <button className={styleBoutonTexte} onClick={onAjouterLotChambres}>
                + Plusieurs {maison.usage_bien === "commerce" ? "boutiques" : "portes"}
              </button>
            </>
          )}
          <button className={styleBoutonTexte} onClick={onModifier}>
            Modifier
          </button>
          <button className="text-xs font-medium text-rose-500 hover:text-rose-600" onClick={onSupprimer}>
            Supprimer
          </button>
        </div>
      </div>

      {uniteUnique ? null : (
        <div className="p-4">
          {maison.chambres.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucune {maison.usage_bien === "commerce" ? "boutique" : "chambre"} pour l'instant.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {maison.chambres.map((chambre) => (
                <ChambreLigne
                  key={chambre.id}
                  chambre={chambre}
                  usageBien={maison.usage_bien}
                  onModifier={() => onModifierChambre(chambre)}
                  onSupprimer={() => onSupprimerChambre(chambre)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// `onChange()` prévient le parent qu'il doit rafraîchir sa liste (utilisé sur
// la carte, où `photos` vient d'en haut). `onPhotosMaj` est optionnel : si
// fourni, il reçoit directement la nouvelle liste (comme un `setState`) pour
// une mise à jour immédiate sans attendre un rechargement complet — utile
// quand ce composant est affiché dans un formulaire qui garde son propre état
// local (voir `MaisonForm`).
function PhotosMaison({ maisonId, photos, onChange, onPhotosMaj }) {
  const inputRef = useRef(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [photoASupprimer, setPhotoASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  async function ajouterPhotos(e) {
    const fichiers = e.target.files;
    if (!fichiers || fichiers.length === 0) return;

    const donnees = new FormData();
    for (const fichier of fichiers) donnees.append("photos", fichier);

    setEnCours(true);
    setErreur("");
    try {
      // Ne pas fixer Content-Type à la main : le navigateur doit calculer
      // lui-même la "boundary" multipart, sinon l'envoi échoue.
      const { data } = await api.post(`/biens/maisons/${maisonId}/photos`, donnees);
      onPhotosMaj?.((prev) => [...prev, ...data.photos]);
      onChange?.();
    } catch (err) {
      setErreur(err.response?.data?.error || "Envoi des photos impossible.");
    } finally {
      setEnCours(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmerSuppressionPhoto() {
    if (!photoASupprimer) return;
    setSuppressionEnCours(true);
    setErreur("");
    try {
      await api.delete(`/biens/photos-maison/${photoASupprimer}`);
      onPhotosMaj?.((prev) => prev.filter((p) => p.id !== photoASupprimer));
      onChange?.();
      setPhotoASupprimer(null);
    } catch (err) {
      setErreur(err.response?.data?.error || "Suppression impossible.");
      setPhotoASupprimer(null);
    } finally {
      setSuppressionEnCours(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-[4/3]">
            <img
              src={photo.url}
              alt="Photo de la maison/cour"
              className="h-full w-full object-cover rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setPhotoASupprimer(photo.id)}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Supprimer la photo"
            >
              ×
            </button>
          </div>
        ))}
        <label className="aspect-[4/3] flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[#1F3A5F] hover:text-[#1F3A5F] cursor-pointer text-sm text-center px-2 transition-colors">
          {enCours ? "Envoi..." : "+ Ajouter une photo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={ajouterPhotos}
            disabled={enCours}
          />
        </label>
      </div>
      {erreur && <p className="text-xs text-rose-600 mt-1">{erreur}</p>}
      <ConfirmerModal
        ouvert={!!photoASupprimer}
        titre="Supprimer la photo"
        message="Supprimer cette photo ?"
        texteConfirmer="Supprimer"
        dangereux
        enCours={suppressionEnCours}
        onAnnuler={() => setPhotoASupprimer(null)}
        onConfirmer={confirmerSuppressionPhoto}
      />
    </div>
  );
}

const ACCENT_STATUT = { libre: "#94A3B8", reservee: "#D97706", occupee: "#2E7D32" };

// Pas de photo par porte ici volontairement : ce qui compte pour le bailleur
// dans cette liste, c'est de voir d'un coup d'œil quelle porte est occupée et
// si son loyer est à jour — la photo de la cour/du bâtiment en haut de la
// carte suffit à identifier le bien.
function ChambreLigne({ chambre, usageBien, onModifier, onSupprimer }) {
  const estCommerce = usageBien === "commerce";
  const prefixePorte = estCommerce ? "Boutique" : "Porte";

  return (
    <div
      className="rounded-lg bg-white border border-slate-200 overflow-hidden border-t-4 px-3 py-2.5"
      style={{ borderTopColor: ACCENT_STATUT[chambre.statut] || "#94A3B8" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-700">
              {prefixePorte} {chambre.numero_porte}
            </p>
            {chambre.etage && (
              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                {chambre.etage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <Badge type={STATUT_BADGE[chambre.statut]}>{STATUT_LABEL[chambre.statut]}</Badge>
            {chambre.statut_paiement && (
              <Badge type={STATUT_PAIEMENT_BADGE[chambre.statut_paiement]}>
                {STATUT_PAIEMENT_LABEL[chambre.statut_paiement]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{formaterFcfa(chambre.prix_mensuel)}/mois</p>
          {(chambre.nombre_chambres || chambre.equipements?.length > 0) && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {[
                chambre.nombre_chambres
                  ? `${chambre.nombre_chambres} chambre${chambre.nombre_chambres > 1 ? "s" : ""}`
                  : null,
                ...(chambre.equipements || []),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="text-slate-400 hover:text-[#1F3A5F]"
            onClick={onModifier}
            aria-label={estCommerce ? "Modifier la boutique" : "Modifier la chambre"}
          >
            ✎
          </button>
          <button
            className="text-slate-400 hover:text-rose-500"
            onClick={onSupprimer}
            aria-label={estCommerce ? "Supprimer la boutique" : "Supprimer la chambre"}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function QuartierForm({ initial, onAnnuler, onEnregistre }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      if (initial) {
        await api.put(`/biens/quartiers/${initial.id}`, { nom });
      } else {
        await api.post("/biens/quartiers", { nom });
      }
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      <Champ label="Nom du quartier">
        <input
          className={styleEntree}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex. Gampela"
          autoFocus
          required
        />
      </Champ>
      {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className={styleBoutonSecondaire} onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
          {enCours ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function MaisonForm({ quartierId, initial, onAnnuler, onEnregistre, onPhotosChangees }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [typeBien, setTypeBien] = useState(initial?.type_bien || "cour");
  const [disposition, setDisposition] = useState(initial?.disposition || "divisee");
  const [usageBien, setUsageBien] = useState(initial?.usage_bien || "habitation");
  const [styleConstruction, setStyleConstruction] = useState(initial?.style_construction || "");
  const [nombreEtages, setNombreEtages] = useState(initial?.nombre_etages ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse_precise || "");
  const [equipements, setEquipements] = useState(initial?.equipements || []);
  const [photos, setPhotos] = useState(initial?.photos || []);
  const [prixMensuel, setPrixMensuel] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  // "Unique" = toute la maison/cour est louée à un seul locataire (une villa
  // entière, par exemple) : il n'y a donc qu'une seule chambre possible, et on
  // la crée nous-mêmes tout de suite (voir plus bas) plutôt que de forcer un
  // second clic sur "+ Chambre" juste après. Seulement à la création : une
  // maison déjà créée a peut-être déjà sa chambre (ou plusieurs, si son
  // usage a changé depuis).
  const demanderPrixUnique = !initial && disposition === "unique";

  // Comme pour une chambre : une photo ajoutée/supprimée ici prend effet tout
  // de suite, et on prévient le parent pour que la carte (en arrière-plan)
  // et une future réouverture de ce formulaire restent à jour.
  function mettreAJourPhotos(maj) {
    setPhotos(maj);
    onPhotosChangees?.();
  }

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const donnees = {
        nom,
        type_bien: typeBien,
        disposition,
        usage_bien: usageBien,
        style_construction: styleConstruction || null,
        nombre_etages: nombreEtages === "" ? null : Number(nombreEtages),
        adresse_precise: adresse,
        equipements,
      };
      if (initial) {
        await api.put(`/biens/maisons/${initial.id}`, donnees);
      } else {
        await api.post("/biens/maisons", {
          ...donnees,
          quartier_id: quartierId,
          prix_mensuel: demanderPrixUnique ? Number(prixMensuel) : undefined,
        });
      }
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      <Champ label="Nom de la maison/cour">
        <input
          className={styleEntree}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex. Cour Zongo"
          autoFocus
          required
        />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Type de bien">
          <select className={styleEntree} value={typeBien} onChange={(e) => setTypeBien(e.target.value)}>
            {TYPES_BIEN.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Cour = concession au sol, une ou plusieurs chambres autour d'une cour. Bâtiment =
            immeuble à un ou plusieurs étages.
          </p>
        </Champ>
        <Champ label="Usage">
          <select className={styleEntree} value={usageBien} onChange={(e) => setUsageBien(e.target.value)}>
            {USAGES_BIEN.map((u) => (
              <option key={u.valeur} value={u.valeur}>
                {u.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Commerce affiche "boutique" au lieu de "chambre" partout sur cette maison/cour.
          </p>
        </Champ>
      </div>
      <Champ label="Disposition">
        <select
          className={styleEntree}
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
        >
          {DISPOSITIONS.map((d) => (
            <option key={d.valeur} value={d.valeur}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">
          Unique = un seul locataire pour toute la maison/cour (ex. une villa entière).
          Divisée = plusieurs chambres/boutiques séparées, chacune avec son propre locataire.
          Ex : une rangée de boutiques en bordure de route = Bâtiment + Commerce + Divisée.
        </p>
      </Champ>
      {demanderPrixUnique && (
        <Champ label="Prix mensuel (FCFA)">
          <input
            className={styleEntree}
            type="number"
            min="0"
            value={prixMensuel}
            onChange={(e) => setPrixMensuel(e.target.value)}
            placeholder="Ex. 75000"
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            Comme c'est "Unique", la chambre correspondant à toute la maison/cour est créée
            automatiquement avec ce prix — tu pourras créer un contrat directement dessus, sans
            étape supplémentaire.
          </p>
        </Champ>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Style (optionnel)">
          <select
            className={styleEntree}
            value={styleConstruction}
            onChange={(e) => setStyleConstruction(e.target.value)}
          >
            {STYLES_CONSTRUCTION.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Juste pour décrire le bâti — n'affecte rien d'autre. Laisse "Aucun" si ça ne s'applique
            pas (ex. une cour).
          </p>
        </Champ>
        <Champ label="Nombre d'étages (optionnel)">
          <input
            className={styleEntree}
            type="number"
            min="0"
            value={nombreEtages}
            onChange={(e) => setNombreEtages(e.target.value)}
            placeholder="Ex. 2"
          />
        </Champ>
      </div>
      <Champ label="Adresse précise (optionnel)">
        <input
          className={styleEntree}
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="Repère, rue, secteur..."
        />
      </Champ>
      <ChampEquipements label="Équipements de la maison/cour (optionnel)">
        <ChoixEquipements
          suggestions={SUGGESTIONS_EQUIPEMENTS_MAISON}
          valeurs={equipements}
          onChange={setEquipements}
        />
      </ChampEquipements>
      <Champ label="Photo(s) de la maison/cour (optionnel)">
        {initial ? (
          <>
            <PhotosMaison maisonId={initial.id} photos={photos} onPhotosMaj={mettreAJourPhotos} />
            <p className="text-xs text-slate-400 mt-1">
              Une photo ajoutée ici s'ajoute tout de suite, même sans cliquer sur "Enregistrer". La
              première photo devient la photo de couverture affichée sur la carte.
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">
            Enregistre d'abord la maison/cour, puis reviens la modifier pour lui ajouter une photo.
          </p>
        )}
      </Champ>
      {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className={styleBoutonSecondaire} onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
          {enCours ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function ChambreForm({ maisonId, usageBien, initial, onAnnuler, onEnregistre }) {
  const estCommerce = usageBien === "commerce";
  const [numero, setNumero] = useState(initial?.numero_porte || "");
  const [prix, setPrix] = useState(initial?.prix_mensuel ?? "");
  const [statut, setStatut] = useState(initial?.statut || "libre");
  const [description, setDescription] = useState(initial?.description || "");
  const [nombreChambres, setNombreChambres] = useState(initial?.nombre_chambres ?? "");
  const [etage, setEtage] = useState(initial?.etage || "");
  const [equipements, setEquipements] = useState(initial?.equipements || []);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const donnees = {
        numero_porte: numero,
        prix_mensuel: Number(prix),
        description,
        nombre_chambres: nombreChambres === "" ? null : Number(nombreChambres),
        etage: etage || null,
        equipements,
      };
      if (initial) {
        await api.put(`/biens/chambres/${initial.id}`, { ...donnees, statut });
      } else {
        await api.post("/biens/chambres", { ...donnees, maison_id: maisonId });
      }
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      <Champ label={estCommerce ? "Numéro de boutique" : "Numéro de porte"}>
        <input
          className={styleEntree}
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Ex. A1"
          autoFocus
          required
        />
      </Champ>
      <Champ label="Prix mensuel (FCFA)">
        <input
          className={styleEntree}
          type="number"
          min="0"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          placeholder="Ex. 25000"
          required
        />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Nombre de chambres (optionnel)">
          <input
            className={styleEntree}
            type="number"
            min="0"
            value={nombreChambres}
            onChange={(e) => setNombreChambres(e.target.value)}
            placeholder="Ex. 2"
          />
          <p className="text-xs text-slate-400 mt-1">
            Pièces à coucher dans cette porte — utile si ce n'est pas une simple chambre nue.
          </p>
        </Champ>
        <Champ label="Étage (optionnel)">
          <input
            className={styleEntree}
            value={etage}
            onChange={(e) => setEtage(e.target.value)}
            placeholder="Ex. RDC, 1er étage..."
          />
        </Champ>
      </div>
      <ChampEquipements label="Équipements de cette porte (optionnel)">
        <ChoixEquipements
          suggestions={SUGGESTIONS_EQUIPEMENTS_CHAMBRE}
          valeurs={equipements}
          onChange={setEquipements}
        />
      </ChampEquipements>
      {initial && (
        <Champ label="Statut">
          <select className={styleEntree} value={statut} onChange={(e) => setStatut(e.target.value)}>
            {Object.entries(STATUT_LABEL).map(([valeur, label]) => (
              <option key={valeur} value={valeur}>
                {label}
              </option>
            ))}
          </select>
        </Champ>
      )}
      <Champ label="Description (optionnel)">
        <textarea
          className={styleEntree}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={estCommerce ? "Détails utiles sur la boutique..." : "Détails utiles sur la chambre..."}
        />
      </Champ>
      {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className={styleBoutonSecondaire} onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
          {enCours ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// Crée plusieurs portes/boutiques d'un coup (ex. les 6 chambres d'un
// célibatorium) au lieu de cliquer "+ Chambre" une par une. Le prix et le
// détail saisis ici s'appliquent à toutes — modifiables ensuite individuellement.
function LotChambresForm({ maisonId, usageBien, onAnnuler, onEnregistre }) {
  const estCommerce = usageBien === "commerce";
  const [prefixe, setPrefixe] = useState("A");
  const [depart, setDepart] = useState("1");
  const [quantite, setQuantite] = useState("6");
  const [prix, setPrix] = useState("");
  const [nombreChambres, setNombreChambres] = useState("");
  const [etage, setEtage] = useState("");
  const [equipements, setEquipements] = useState([]);
  const [description, setDescription] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const apercu = useMemo(() => {
    const n = Number(quantite);
    const d = Number(depart);
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(d) || d < 1 || !prefixe.trim()) return [];
    const nb = Math.min(n, 6);
    const numeros = Array.from({ length: nb }, (_, i) => `${prefixe.trim()}${d + i}`);
    return n > 6 ? [...numeros, `… (${n} au total)`] : numeros;
  }, [prefixe, depart, quantite]);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      await api.post(`/biens/maisons/${maisonId}/chambres-lot`, {
        prefixe,
        depart: Number(depart),
        quantite: Number(quantite),
        prix_mensuel: Number(prix),
        nombre_chambres: nombreChambres === "" ? null : Number(nombreChambres),
        etage: etage || null,
        equipements,
        description,
      });
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      <p className="text-xs text-slate-500 mb-3">
        Crée plusieurs {estCommerce ? "boutiques" : "portes"} numérotées automatiquement, avec le
        même prix et le même détail de départ — tu pourras ensuite ajuster chacune individuellement
        (photo, prix différent, statut...).
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Champ label="Préfixe">
          <input
            className={styleEntree}
            value={prefixe}
            onChange={(e) => setPrefixe(e.target.value)}
            placeholder="Ex. A"
            autoFocus
            required
          />
        </Champ>
        <Champ label="Départ à">
          <input
            className={styleEntree}
            type="number"
            min="1"
            value={depart}
            onChange={(e) => setDepart(e.target.value)}
            required
          />
        </Champ>
        <Champ label="Combien ?">
          <input
            className={styleEntree}
            type="number"
            min="1"
            max="60"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            required
          />
        </Champ>
      </div>
      {apercu.length > 0 && (
        <p className="text-xs text-slate-500 mb-3 -mt-1">
          Ça donnera : <strong>{apercu.join(", ")}</strong>
        </p>
      )}
      <Champ label="Prix mensuel (FCFA) — pour toutes">
        <input
          className={styleEntree}
          type="number"
          min="0"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          placeholder="Ex. 25000"
          required
        />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Nombre de chambres (optionnel)">
          <input
            className={styleEntree}
            type="number"
            min="0"
            value={nombreChambres}
            onChange={(e) => setNombreChambres(e.target.value)}
            placeholder="Ex. 2"
          />
        </Champ>
        <Champ label="Étage (optionnel)">
          <input
            className={styleEntree}
            value={etage}
            onChange={(e) => setEtage(e.target.value)}
            placeholder="Ex. RDC, 1er étage..."
          />
        </Champ>
      </div>
      <ChampEquipements label="Équipements (optionnel)">
        <ChoixEquipements
          suggestions={SUGGESTIONS_EQUIPEMENTS_CHAMBRE}
          valeurs={equipements}
          onChange={setEquipements}
        />
      </ChampEquipements>
      <Champ label="Description (optionnel)">
        <textarea
          className={styleEntree}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Détails utiles, communs à toutes ces portes..."
        />
      </Champ>
      {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className={styleBoutonSecondaire} onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
          {enCours ? "Création..." : "Créer"}
        </button>
      </div>
    </form>
  );
}
