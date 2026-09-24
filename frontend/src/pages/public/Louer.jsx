import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/client.js";
import Badge from "../../components/ui/Badge.jsx";
import CandidatureModal from "./CandidatureModal.jsx";

const USAGE_LABEL = { habitation: "Habitation", commerce: "Commerce (boutique)" };
const TYPE_LABEL = { cour: "Cour", batiment: "Bâtiment" };
const DISPOSITION_LABEL = { unique: "Unique", divisee: "Divisée" };
const STYLE_LABEL = { villa: "Villa", demi_villa: "Demi-villa" };
const ICONE = { cour: "🏡", batiment: "🏢" };

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

function iconeUnite(unite) {
  if (unite.maison.usage_bien === "commerce") return "🏪";
  return ICONE[unite.maison.type_bien] || "🏠";
}

function etiquettesUnite(unite) {
  return [
    TYPE_LABEL[unite.maison.type_bien],
    STYLE_LABEL[unite.maison.style_construction],
    unite.maison.nombre_etages ? `${unite.maison.nombre_etages} étage${unite.maison.nombre_etages > 1 ? "s" : ""}` : null,
    DISPOSITION_LABEL[unite.maison.disposition],
  ].filter(Boolean);
}

export default function Louer() {
  const [unites, setUnites] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreUsage, setFiltreUsage] = useState("");
  const [filtreQuartier, setFiltreQuartier] = useState("");
  const [uniteChoisie, setUniteChoisie] = useState(null);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    const params = {};
    if (filtreUsage) params.usage = filtreUsage;
    if (filtreQuartier) params.quartier_id = filtreQuartier;

    api
      .get("/public/biens-disponibles", { params })
      .then(({ data }) => {
        if (annule) return;
        setUnites(data.unites);
        setErreur("");
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de charger les biens disponibles pour le moment.");
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [filtreUsage, filtreQuartier]);

  // Liste complète des quartiers pour le filtre — chargée une seule fois,
  // indépendamment des filtres actifs, pour que le menu ne perde pas d'options
  // au fil des sélections.
  const [tousQuartiers, setTousQuartiers] = useState([]);
  useEffect(() => {
    api
      .get("/public/biens-disponibles")
      .then(({ data }) => {
        const uniques = new Map(data.unites.map((u) => [u.quartier.id, u.quartier]));
        setTousQuartiers([...uniques.values()].sort((a, b) => a.nom.localeCompare(b.nom)));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <header className="bg-[#1F3A5F] text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
          <p className="text-2xl font-semibold">Trouve ton logement</p>
          <p className="text-sm text-white/70 mt-1">
            Chambres, boutiques, villas... consulte ce qui est disponible dès maintenant.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-5">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            value={filtreUsage}
            onChange={(e) => setFiltreUsage(e.target.value)}
          >
            <option value="">Tous usages</option>
            <option value="habitation">Habitation</option>
            <option value="commerce">Commerce (boutique)</option>
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            value={filtreQuartier}
            onChange={(e) => setFiltreQuartier(e.target.value)}
          >
            <option value="">Tous les quartiers</option>
            {tousQuartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom}
              </option>
            ))}
          </select>
          {(filtreUsage || filtreQuartier) && (
            <button
              className="text-xs font-medium text-slate-500 hover:text-[#1F3A5F]"
              onClick={() => {
                setFiltreUsage("");
                setFiltreQuartier("");
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {erreur && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{erreur}</div>
        )}

        {chargement && <p className="text-sm text-slate-500">Chargement...</p>}

        {!chargement && !erreur && unites.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">Rien de disponible pour ces critères pour l'instant.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence initial={false}>
            {unites.map((unite) => (
              <motion.button
                key={unite.chambre.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setUniteChoisie(unite)}
                className="text-left rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                {unite.photos[0] ? (
                  <img src={unite.photos[0].url} alt={unite.maison.nom} className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 w-full flex items-center justify-center bg-slate-100 text-5xl">
                    {iconeUnite(unite)}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-medium text-slate-800">{unite.maison.nom}</p>
                    {unite.maison.usage_bien === "commerce" && <Badge type="attention">Commerce</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {unite.maison.usage_bien === "commerce" ? "Boutique" : "Porte"} {unite.chambre.numero_porte} ·{" "}
                    {unite.quartier.nom}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{etiquettesUnite(unite).join(" · ")}</p>
                  {unite.chambre.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{unite.chambre.description}</p>
                  )}
                  <p className="text-base font-semibold text-[#1F3A5F] mt-3">
                    {formaterFcfa(unite.chambre.prix_mensuel)}
                    <span className="text-xs font-normal text-slate-400">/mois</span>
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <CandidatureModal unite={uniteChoisie} onFermer={() => setUniteChoisie(null)} />
    </div>
  );
}
