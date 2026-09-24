import { useEffect, useMemo, useState } from "react";
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

const METHODES = [
  { valeur: "especes", label: "Espèces", icone: "💵" },
  { valeur: "orange_money", label: "Orange Money", icone: "🟠" },
  { valeur: "moov_money", label: "Moov Money", icone: "🔵" },
  { valeur: "wave", label: "Wave", icone: "🌊" },
];
const METHODE_LABEL = Object.fromEntries(METHODES.map((m) => [m.valeur, m.label]));
const METHODE_ICONE = Object.fromEntries(METHODES.map((m) => [m.valeur, m.icone]));

const STATUT_BADGE = { a_jour: "ok", partiel: "attention", en_retard: "erreur", en_attente: "neutre" };
const STATUT_LABEL = {
  a_jour: "À jour",
  partiel: "Partiel",
  en_retard: "En retard",
  en_attente: "En attente",
};

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

function formaterDateHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function moisLabel(moisISO) {
  if (!moisISO) return "";
  const d = new Date(moisISO);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function decalerMois(moisISO, delta) {
  const [annee, mois] = moisISO.split("-").map(Number);
  const d = new Date(annee, mois - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function moisActuelISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Paiements() {
  const [mois, setMois] = useState(moisActuelISO());
  const [echeances, setEcheances] = useState([]);
  const [versements, setVersements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [modalPaiement, setModalPaiement] = useState(null); // { echeance }
  const [versementsEnAttente, setVersementsEnAttente] = useState([]);
  const [enAttenteCours, setEnAttenteCours] = useState(null); // id du versement en cours de traitement
  const [versementARejeter, setVersementARejeter] = useState(null); // id du versement

  async function charger() {
    setChargement(true);
    try {
      const [rEcheances, rVersements, rEnAttente] = await Promise.all([
        api.get("/paiements/echeances", { params: { mois } }),
        api.get("/paiements/versements", { params: { mois } }),
        api.get("/paiements/versements-en-attente"),
      ]);
      setEcheances(rEcheances.data.echeances);
      setVersements(rVersements.data.versements);
      setVersementsEnAttente(rEnAttente.data.versements);
      setErreur("");
    } catch {
      setErreur("Impossible de charger les paiements pour le moment.");
    } finally {
      setChargement(false);
    }
  }

  async function confirmerVersement(id) {
    setEnAttenteCours(id);
    setErreur("");
    try {
      await api.put(`/paiements/versements/${id}/confirmer`);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.error || "Impossible de confirmer ce paiement.");
    } finally {
      setEnAttenteCours(null);
    }
  }

  async function confirmerRejetVersement() {
    if (!versementARejeter) return;
    const id = versementARejeter;
    setVersementARejeter(null);
    setEnAttenteCours(id);
    setErreur("");
    try {
      await api.put(`/paiements/versements/${id}/rejeter`);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.error || "Impossible de rejeter ce paiement.");
    } finally {
      setEnAttenteCours(null);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  const stats = useMemo(() => {
    const totalDu = echeances.reduce((s, e) => s + e.montant_du, 0);
    const totalVerse = echeances.reduce((s, e) => s + e.montant_verse, 0);
    const enRetard = echeances.filter((e) => e.statut === "en_retard").length;
    const taux = totalDu ? Math.round((totalVerse / totalDu) * 100) : 0;
    return { totalDu, totalVerse, enRetard, taux };
  }, [echeances]);

  if (chargement && echeances.length === 0) {
    return <Card>Chargement…</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Paiements</h1>
          <p className="text-sm text-slate-500 capitalize">{moisLabel(mois)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={styleBoutonSecondaire} onClick={() => setMois((m) => decalerMois(m, -1))}>
            ← Mois précédent
          </button>
          {mois !== moisActuelISO() && (
            <button className={styleBoutonTexte} onClick={() => setMois(moisActuelISO())}>
              Revenir au mois actuel
            </button>
          )}
          <button className={styleBoutonSecondaire} onClick={() => setMois((m) => decalerMois(m, 1))}>
            Mois suivant →
          </button>
        </div>
      </div>

      {erreur && (
        <Card className="border-rose-200 bg-rose-50">
          <p className="text-sm text-rose-700">{erreur}</p>
        </Card>
      )}

      {versementsEnAttente.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800 mb-3">
            {versementsEnAttente.length} paiement{versementsEnAttente.length > 1 ? "s" : ""} déclaré
            {versementsEnAttente.length > 1 ? "s" : ""} par un locataire, en attente de ta confirmation
          </p>
          <div className="space-y-2">
            {versementsEnAttente.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 border border-amber-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {v.locataire.nom_complet} · {formaterFcfa(v.montant)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {METHODE_ICONE[v.methode]} {METHODE_LABEL[v.methode] || v.methode}
                    {v.numero_expediteur ? ` · depuis ${v.numero_expediteur}` : ""}
                    {v.reference_transaction ? ` · réf. ${v.reference_transaction}` : ""} ·{" "}
                    {formaterDateHeure(v.verse_le)}
                  </p>
                  <p className="text-xs text-slate-400">
                    🚪 {v.chambre.numero_porte} — {v.chambre.maison_nom} ({v.chambre.quartier_nom})
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className={styleBoutonSecondaire}
                    onClick={() => setVersementARejeter(v.id)}
                    disabled={enAttenteCours === v.id}
                  >
                    Rien reçu
                  </button>
                  <button
                    className={styleBoutonPrimaire}
                    onClick={() => confirmerVersement(v.id)}
                    disabled={enAttenteCours === v.id}
                  >
                    {enAttenteCours === v.id ? "..." : "Confirmer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {echeances.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total dû ce mois" valeur={formaterFcfa(stats.totalDu)} delai={0} />
          <StatCard label="Encaissé" valeur={formaterFcfa(stats.totalVerse)} delai={0.05} accent="#2E7D32" />
          <StatCard label="Taux de recouvrement" valeur={`${stats.taux}%`} delai={0.1} />
          <StatCard label="Locataires en retard" valeur={stats.enRetard} delai={0.15} accent="#C0392B" />
        </div>
      )}

      {echeances.length === 0 && !erreur && (
        <Card>
          <p className="text-sm text-slate-500">
            Aucun contrat actif pour ce mois — enregistre d'abord un locataire avec un contrat
            depuis l'onglet Locataires.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {echeances.map((e) => (
          <Card key={e.contrat_id} className="!py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-800">{e.locataire.nom_complet}</p>
                  <Badge type={STATUT_BADGE[e.statut]}>{STATUT_LABEL[e.statut]}</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  🚪 Porte {e.chambre.numero_porte} — {e.chambre.maison_nom} ({e.chambre.quartier_nom})
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <p className="text-slate-800 font-medium">
                    {formaterFcfa(e.montant_verse)} / {formaterFcfa(e.montant_du)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {e.reste > 0 ? `Reste ${formaterFcfa(e.reste)}` : "Complet"}
                  </p>
                </div>
                {e.reste > 0 && (
                  <button className={styleBoutonPrimaire} onClick={() => setModalPaiement({ echeance: e })}>
                    + Paiement
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-2">
        <p className="text-sm font-medium text-slate-700 mb-2">
          Transactions du mois ({versements.length})
        </p>
        {versements.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">Aucune transaction enregistrée pour ce mois.</p>
          </Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date &amp; heure</th>
                    <th className="text-left px-4 py-2 font-medium">Locataire</th>
                    <th className="text-left px-4 py-2 font-medium">Chambre</th>
                    <th className="text-right px-4 py-2 font-medium">Montant</th>
                    <th className="text-left px-4 py-2 font-medium">Moyen</th>
                    <th className="text-left px-4 py-2 font-medium">Référence</th>
                    <th className="text-left px-4 py-2 font-medium">Reçu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versements.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                        {formaterDateHeure(v.verse_le)}
                      </td>
                      <td className="px-4 py-2 text-slate-800">{v.locataire.nom_complet}</td>
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                        {v.chambre.numero_porte} — {v.chambre.maison_nom}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800 whitespace-nowrap">
                        {formaterFcfa(v.montant)}
                      </td>
                      <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                        {METHODE_ICONE[v.methode]} {METHODE_LABEL[v.methode] || v.methode}
                      </td>
                      <td className="px-4 py-2 text-slate-400">{v.reference_transaction || "—"}</td>
                      <td className="px-4 py-2">
                        {v.statut_versement === "en_attente_confirmation" ? (
                          <Badge type="attention">En attente</Badge>
                        ) : v.statut_versement === "rejete" ? (
                          <Badge type="erreur">Rejeté</Badge>
                        ) : (
                          <BoutonRecu versement={v} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {modalPaiement && (
        <FormulairePaiement
          echeance={modalPaiement.echeance}
          mois={mois}
          onFermer={() => setModalPaiement(null)}
          onEnregistre={() => {
            setModalPaiement(null);
            charger();
          }}
        />
      )}

      <ConfirmerModal
        ouvert={!!versementARejeter}
        titre="Rejeter ce paiement"
        message="Confirmer que tu n'as rien reçu pour ce paiement ?"
        texteConfirmer="Rien reçu"
        dangereux
        onAnnuler={() => setVersementARejeter(null)}
        onConfirmer={confirmerRejetVersement}
      />
    </div>
  );
}

function BoutonRecu({ versement }) {
  const [url, setUrl] = useState(versement.recu_pdf_url);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function ouvrirOuGenerer() {
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      const { data } = await api.get(`/paiements/versements/${versement.id}/recu-url`);
      setUrl(data.url);
      window.open(data.url, "_blank", "noopener");
    } catch {
      setErreur("Impossible de générer le reçu pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <button className={styleBoutonTexte} onClick={ouvrirOuGenerer} disabled={enCours}>
        {enCours ? "…" : "📄 Voir le reçu"}
      </button>
      {erreur && <p className="text-xs text-rose-600 mt-0.5">{erreur}</p>}
    </div>
  );
}

function FormulairePaiement({ echeance, mois, onFermer, onEnregistre }) {
  const [montant, setMontant] = useState(String(echeance.reste));
  const [methode, setMethode] = useState("orange_money");
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      await api.post("/paiements/versements", {
        contrat_id: echeance.contrat_id,
        montant: Number(montant),
        methode,
        reference_transaction: reference || undefined,
        mois,
      });
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal
      ouvert={true}
      onFermer={onFermer}
      titre={`Enregistrer un paiement — ${echeance.locataire.nom_complet}`}
    >
      <p className="text-xs text-slate-500 mb-3">
        Porte {echeance.chambre.numero_porte} — {echeance.chambre.maison_nom} · Reste dû :{" "}
        <strong>{formaterFcfa(echeance.reste)}</strong>
      </p>
      <form onSubmit={soumettre}>
        <Champ label="Montant versé (FCFA)">
          <input
            type="number"
            min="1"
            className={styleEntree}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
            autoFocus
          />
        </Champ>
        <Champ label="Moyen de paiement">
          <select className={styleEntree} value={methode} onChange={(e) => setMethode(e.target.value)}>
            {METHODES.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.icone} {m.label}
              </option>
            ))}
          </select>
        </Champ>
        {methode !== "especes" && (
          <Champ label="Référence de la transaction (optionnel)">
            <input
              className={styleEntree}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex. OM12345678"
            />
          </Champ>
        )}
        {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
            Annuler
          </button>
          <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
