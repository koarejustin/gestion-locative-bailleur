import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client.js";
import { useAuthLocataire } from "../../auth/AuthContextLocataire.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Modal from "../../components/ui/Modal.jsx";
import ConfirmerModal from "../../components/ui/ConfirmerModal.jsx";
import Champ, { styleEntree, styleBoutonPrimaire, styleBoutonSecondaire } from "../../components/ui/Champ.jsx";

const STATUT_BADGE = { a_jour: "ok", partiel: "attention", en_retard: "erreur", en_attente: "neutre" };
const STATUT_LABEL = {
  a_jour: "Loyer à jour",
  partiel: "Paiement partiel",
  en_retard: "Loyer en retard",
  en_attente: "En attente",
};
const CAUTION_STATUT_LABEL = {
  detenue: "Détenue",
  restituee_totale: "Restituée en totalité",
  restituee_partielle: "Restituée en partie",
  retenue: "Retenue",
};
const METHODE_LABEL = {
  especes: "Espèces",
  orange_money: "Orange Money",
  moov_money: "Moov Money",
  wave: "Wave",
};
const METHODE_ICONE = { especes: "💵", orange_money: "🟠", moov_money: "🔵", wave: "🌊" };
const METHODES_MOBILE_MONEY = ["orange_money", "moov_money", "wave"];

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

function formaterDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
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

export default function EspaceLocataire() {
  const { locataire, deconnecter } = useAuthLocataire();
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [erreur, setErreur] = useState("");
  const [modalPaiementOuvert, setModalPaiementOuvert] = useState(false);

  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [photoErreur, setPhotoErreur] = useState("");
  const [confirmerRetraitPhoto, setConfirmerRetraitPhoto] = useState(false);
  const [retraitPhotoEnCours, setRetraitPhotoEnCours] = useState(false);
  const inputPhotoRef = useRef(null);

  function charger() {
    return Promise.all([api.get("/espace-locataire/mon-contrat"), api.get("/espace-locataire/mon-historique")]).then(
      ([r1, r2]) => {
        setDonnees(r1.data);
        setHistorique(r2.data);
      }
    );
  }

  useEffect(() => {
    let annule = false;
    charger().catch(() => {
      if (!annule) setErreur("Impossible de charger tes informations pour le moment.");
    });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (donnees?.locataire) setPhotoUrl(donnees.locataire.photo_url || null);
  }, [donnees]);

  function seDeconnecter() {
    deconnecter();
    navigate("/locataire/connexion", { replace: true });
  }

  async function changerPhoto(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const donneesForm = new FormData();
    donneesForm.append("photo", fichier);
    setPhotoEnCours(true);
    setPhotoErreur("");
    try {
      const { data } = await api.post("/espace-locataire/ma-photo", donneesForm);
      setPhotoUrl(data.photo_url);
    } catch (err) {
      setPhotoErreur(err.response?.data?.error || "Envoi de la photo impossible.");
    } finally {
      setPhotoEnCours(false);
      if (inputPhotoRef.current) inputPhotoRef.current.value = "";
    }
  }

  async function confirmerRetirerPhoto() {
    setRetraitPhotoEnCours(true);
    setPhotoErreur("");
    try {
      await api.delete("/espace-locataire/ma-photo");
      setPhotoUrl(null);
      setConfirmerRetraitPhoto(false);
    } catch (err) {
      setPhotoErreur(err.response?.data?.error || "Suppression impossible.");
      setConfirmerRetraitPhoto(false);
    } finally {
      setRetraitPhotoEnCours(false);
    }
  }

  const prenom = locataire?.nom_complet?.split(" ")[0] || "";
  const contrat = donnees?.contrat;

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-8 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 group">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Ma photo de profil"
                className="h-12 w-12 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-lg font-semibold">
                {prenom ? prenom[0].toUpperCase() : "👤"}
              </div>
            )}
            <label
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#1F3A5F] text-white text-[10px] flex items-center justify-center cursor-pointer border-2 border-white"
              aria-label="Changer ma photo"
            >
              {photoEnCours ? "…" : "✎"}
              <input
                ref={inputPhotoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={changerPhoto}
                disabled={photoEnCours}
              />
            </label>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setConfirmerRetraitPhoto(true)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Retirer ma photo"
              >
                ×
              </button>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-800 truncate">
              {prenom ? `Bonjour, ${prenom}` : "Espace locataire"}
            </p>
            <p className="text-xs text-slate-500">Mon logement et mes paiements</p>
          </div>
        </div>
        <button onClick={seDeconnecter} className="text-xs font-medium text-rose-600 hover:underline shrink-0">
          Se déconnecter
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-5">
        {photoErreur && (
          <Card className="border-rose-200 bg-rose-50">
            <p className="text-sm text-rose-700">{photoErreur}</p>
          </Card>
        )}
        {erreur && (
          <Card className="border-rose-200 bg-rose-50">
            <p className="text-sm text-rose-700">{erreur}</p>
          </Card>
        )}

        {!donnees && !erreur && <p className="text-sm text-slate-500">Chargement...</p>}

        {donnees && !contrat && (
          <Card>
            <p className="text-sm text-slate-600">
              Aucun logement associé à ton compte pour le moment. Contacte ton bailleur si ça te semble
              anormal.
            </p>
          </Card>
        )}

        {contrat && (
          <>
            <Card className="overflow-hidden !p-0">
              {contrat.photo_url && (
                <img src={contrat.photo_url} alt="Mon logement" className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <p className="text-base font-semibold text-slate-800">
                  Porte {contrat.chambre.numero_porte} — {contrat.maison.nom}
                </p>
                <p className="text-sm text-slate-500">{contrat.quartier}</p>
                {contrat.maison.adresse && (
                  <p className="text-xs text-slate-400 mt-1">{contrat.maison.adresse}</p>
                )}
                {!contrat.actif && (
                  <p className="text-xs font-medium text-amber-600 mt-2">
                    Contrat terminé{contrat.date_fin ? ` le ${formaterDate(contrat.date_fin)}` : ""}
                  </p>
                )}
              </div>
            </Card>

            {donnees.situation_mois && (
              <Card>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p className="text-sm font-medium text-slate-700">Situation du mois</p>
                  <Badge type={STATUT_BADGE[donnees.situation_mois.statut]}>
                    {STATUT_LABEL[donnees.situation_mois.statut] || donnees.situation_mois.statut}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-slate-400">Loyer dû</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {formaterFcfa(donnees.situation_mois.montant_du)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Versé</p>
                    <p className="text-sm font-semibold text-emerald-700">
                      {formaterFcfa(donnees.situation_mois.montant_verse)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Reste</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {formaterFcfa(donnees.situation_mois.reste)}
                    </p>
                  </div>
                </div>
                {contrat.actif && (
                  <button
                    className={`${styleBoutonPrimaire} w-full mt-4`}
                    onClick={() => setModalPaiementOuvert(true)}
                  >
                    J'ai payé depuis mon numéro
                  </button>
                )}
              </Card>
            )}

            <Card>
              <p className="text-sm font-medium text-slate-700 mb-3">Mon contrat</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Loyer mensuel</dt>
                  <dd className="text-slate-800 font-medium">{formaterFcfa(contrat.loyer_mensuel)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Échéance</dt>
                  <dd className="text-slate-800">le {contrat.jour_echeance} du mois</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Locataire depuis</dt>
                  <dd className="text-slate-800">{formaterDate(contrat.date_debut)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Caution</dt>
                  <dd className="text-slate-800 font-medium">
                    {formaterFcfa(contrat.caution_montant)} —{" "}
                    {CAUTION_STATUT_LABEL[contrat.caution_statut] || contrat.caution_statut}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <p className="text-sm font-medium text-slate-700 mb-2">Mon bailleur</p>
              <p className="text-sm text-slate-800">{contrat.bailleur.nom_complet}</p>
              <p className="text-sm text-slate-500">{contrat.bailleur.telephone}</p>
            </Card>

            <Card>
              <p className="text-sm font-medium text-slate-700 mb-3">Historique des paiements</p>
              {historique?.versements?.length ? (
                <div className="divide-y divide-slate-100">
                  {historique.versements.map((v) => (
                    <div key={v.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-slate-800 font-medium">{formaterFcfa(v.montant)}</p>
                          {v.statut_versement === "en_attente_confirmation" && (
                            <Badge type="attention">En attente de confirmation</Badge>
                          )}
                          {v.statut_versement === "rejete" && <Badge type="erreur">Non confirmé</Badge>}
                        </div>
                        <p className="text-xs text-slate-400">
                          {formaterDateHeure(v.verse_le)} · {METHODE_ICONE[v.methode]}{" "}
                          {METHODE_LABEL[v.methode] || v.methode}
                          {v.reference_transaction ? ` · ${v.reference_transaction}` : ""}
                        </p>
                      </div>
                      {v.recu_pdf_url ? (
                        <a
                          href={v.recu_pdf_url}
                          target="_blank"
                          rel="noopener"
                          className="text-xs font-medium text-[#1F3A5F] hover:underline whitespace-nowrap"
                        >
                          📄 Reçu
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300 whitespace-nowrap">Reçu indispo</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Aucun paiement enregistré pour l'instant.</p>
              )}
            </Card>
          </>
        )}
      </main>

      {modalPaiementOuvert && (
        <DeclarerPaiementModal
          onFermer={() => setModalPaiementOuvert(false)}
          onEnregistre={() => {
            setModalPaiementOuvert(false);
            charger().catch(() => {});
          }}
        />
      )}

      <ConfirmerModal
        ouvert={confirmerRetraitPhoto}
        titre="Retirer ma photo"
        message="Retirer ta photo de profil ?"
        texteConfirmer="Retirer"
        dangereux
        enCours={retraitPhotoEnCours}
        onAnnuler={() => setConfirmerRetraitPhoto(false)}
        onConfirmer={confirmerRetirerPhoto}
      />
    </div>
  );
}

// Le locataire déclare avoir envoyé un paiement depuis son propre numéro —
// ça n'est pas encore compté dans son solde : le bailleur doit d'abord
// confirmer l'avoir bien reçu sur son propre compte Mobile Money.
function DeclarerPaiementModal({ onFermer, onEnregistre }) {
  const [montant, setMontant] = useState("");
  const [methode, setMethode] = useState("orange_money");
  const [numeroExpediteur, setNumeroExpediteur] = useState("");
  const [referenceTransaction, setReferenceTransaction] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      await api.post("/espace-locataire/declarer-paiement", {
        montant: Number(montant),
        methode,
        numero_expediteur: numeroExpediteur || undefined,
        reference_transaction: referenceTransaction || undefined,
      });
      setSucces(true);
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal ouvert={true} onFermer={onFermer} titre="J'ai payé depuis mon numéro">
      {succes ? (
        <div>
          <p className="text-sm text-slate-600 mb-4">
            C'est noté. Ton bailleur va vérifier la réception sur son compte, puis confirmer le paiement — il
            apparaîtra alors dans ton historique avec le reçu.
          </p>
          <button className={`${styleBoutonPrimaire} w-full`} onClick={onEnregistre}>
            Fermer
          </button>
        </div>
      ) : (
        <form onSubmit={soumettre}>
          <p className="text-xs text-slate-500 mb-3">
            Envoie d'abord la somme depuis ton téléphone vers le numéro Mobile Money de ton bailleur, puis
            déclare-le ici pour qu'il puisse le confirmer.
          </p>
          <Champ label="Montant envoyé (FCFA)">
            <input
              className={styleEntree}
              type="number"
              min="1"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="Ex. 25000"
              autoFocus
              required
            />
          </Champ>
          <Champ label="Moyen de paiement">
            <select className={styleEntree} value={methode} onChange={(e) => setMethode(e.target.value)}>
              {["orange_money", "moov_money", "wave", "especes"].map((m) => (
                <option key={m} value={m}>
                  {METHODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Champ>
          {METHODES_MOBILE_MONEY.includes(methode) && (
            <Champ label="Ton numéro (celui utilisé pour l'envoi)">
              <input
                className={styleEntree}
                value={numeroExpediteur}
                onChange={(e) => setNumeroExpediteur(e.target.value)}
                placeholder="Ex. 70 12 34 56"
              />
            </Champ>
          )}
          <Champ label="Référence de la transaction (optionnel)">
            <input
              className={styleEntree}
              value={referenceTransaction}
              onChange={(e) => setReferenceTransaction(e.target.value)}
              placeholder="Ex. code reçu par SMS de l'opérateur"
            />
          </Champ>

          {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
              {enCours ? "Envoi..." : "Déclarer ce paiement"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
