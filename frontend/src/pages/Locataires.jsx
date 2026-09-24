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

const TYPE_BIEN_LABEL = { cour: "Cour", batiment: "Bâtiment" };
const ICONE_TYPE_BIEN = { cour: "🏡", batiment: "🏢" };

const STATUT_PAIEMENT_BADGE = { a_jour: "ok", partiel: "attention", en_retard: "erreur", en_attente: "neutre" };
const STATUT_PAIEMENT_LABEL = {
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

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

function formaterDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function Locataires() {
  const [locataires, setLocataires] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const [modalLocataire, setModalLocataire] = useState(null); // { locataire } ou { } pour créer
  const [modalContrat, setModalContrat] = useState(null); // { locataire }
  const [modalCode, setModalCode] = useState(null); // { locataire, code, expire }
  const [modalTerminer, setModalTerminer] = useState(null); // { locataire }
  const [locataireASupprimer, setLocataireASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const stats = useMemo(() => {
    const loges = locataires.filter((l) => l.contrat);
    const revenuMensuel = loges.reduce((s, l) => s + l.contrat.loyer_mensuel, 0);
    const accesActives = locataires.filter((l) => l.compte_actif).length;
    return {
      total: locataires.length,
      loges: loges.length,
      revenuMensuel,
      accesActives,
    };
  }, [locataires]);

  async function charger() {
    setChargement(true);
    try {
      const { data } = await api.get("/location/locataires");
      setLocataires(data.locataires);
      setErreur("");
    } catch {
      setErreur("Impossible de charger les locataires pour le moment.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  async function confirmerSuppressionLocataire() {
    if (!locataireASupprimer) return;
    setSuppressionEnCours(true);
    setErreur("");
    try {
      await api.delete(`/location/locataires/${locataireASupprimer.id}`);
      setLocataireASupprimer(null);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.error || "Suppression impossible.");
      setLocataireASupprimer(null);
    } finally {
      setSuppressionEnCours(false);
    }
  }

  async function genererCode(locataire) {
    setErreur("");
    try {
      const { data } = await api.post(`/location/locataires/${locataire.id}/code-acces`);
      setModalCode({ locataire, code: data.code, expire: data.expire });
      charger();
    } catch (err) {
      setErreur(err.response?.data?.error || "Impossible de générer le code d'accès.");
    }
  }

  if (chargement) {
    return <Card>Chargement…</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Locataires</h1>
          <p className="text-sm text-slate-500">
            {locataires.length} locataire{locataires.length > 1 ? "s" : ""} enregistré
            {locataires.length > 1 ? "s" : ""}
          </p>
        </div>
        <button className={styleBoutonPrimaire} onClick={() => setModalLocataire({})}>
          + Ajouter un locataire
        </button>
      </div>

      {locataires.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Locataires" valeur={stats.total} delai={0} />
          <StatCard label="Logés actuellement" valeur={stats.loges} delai={0.05} accent="#2E7D32" />
          <StatCard label="Revenu mensuel" valeur={formaterFcfa(stats.revenuMensuel)} delai={0.1} />
          <StatCard label="Accès locataire activés" valeur={stats.accesActives} delai={0.15} />
        </div>
      )}

      {erreur && (
        <Card className="border-rose-200 bg-rose-50">
          <p className="text-sm text-rose-700">{erreur}</p>
        </Card>
      )}

      {locataires.length === 0 && !erreur && (
        <Card>
          <p className="text-sm text-slate-500">
            Aucun locataire pour l'instant. Ajoute ton premier locataire pour lui créer un
            contrat.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {locataires.map((locataire) => (
          <Card key={locataire.id} className="!p-0 overflow-hidden">
            <div className="flex items-start justify-between gap-4 flex-wrap p-4">
              <div className="flex items-start gap-3 min-w-0">
                {locataire.photo_url ? (
                  <img
                    src={locataire.photo_url}
                    alt={`Photo de ${locataire.nom_complet}`}
                    className="h-14 w-14 shrink-0 object-cover rounded-full border border-slate-200"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 text-lg font-semibold">
                    {locataire.nom_complet?.[0]?.toUpperCase() || "👤"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">{locataire.nom_complet}</p>
                    <Badge type={locataire.compte_actif ? "ok" : "neutre"}>
                      {locataire.compte_actif ? "Accès activé" : "Accès non activé"}
                    </Badge>
                    {locataire.origine === "candidature_en_ligne" && (
                      <Badge type="attention">Signé en ligne</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{locataire.telephone}</p>
                  {locataire.piece_identite_num && (
                    <p className="text-xs text-slate-400">CNIB : {locataire.piece_identite_num}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex gap-3">
                  <button
                    className={styleBoutonTexte}
                    onClick={() => setModalLocataire({ locataire })}
                  >
                    Modifier
                  </button>
                  <button
                    className={`${styleBoutonTexte} text-rose-500 hover:text-rose-700`}
                    onClick={() => setLocataireASupprimer(locataire)}
                  >
                    Supprimer
                  </button>
                </div>
                {locataire.contrat ? (
                  <button
                    className={`${styleBoutonTexte} text-rose-500 hover:text-rose-700`}
                    onClick={() => setModalTerminer({ locataire })}
                  >
                    Terminer le contrat
                  </button>
                ) : (
                  <button
                    className={styleBoutonTexte}
                    onClick={() => setModalContrat({ locataire })}
                  >
                    Créer un contrat
                  </button>
                )}
                <button className={styleBoutonTexte} onClick={() => genererCode(locataire)}>
                  {locataire.compte_actif ? "Nouveau code d'accès" : "Générer un code d'accès"}
                </button>
              </div>
            </div>

            {locataire.contrat ? (
              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-stretch gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    {locataire.contrat.chambre.maison_photo_url ? (
                      <img
                        src={locataire.contrat.chambre.maison_photo_url}
                        alt={`Photo de ${locataire.contrat.chambre.maison_nom}`}
                        className="h-8 w-8 shrink-0 object-cover rounded-md border border-slate-200"
                      />
                    ) : (
                      <span className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-base">
                        {ICONE_TYPE_BIEN[locataire.contrat.chambre.maison_type] || "🚪"}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">
                        Porte {locataire.contrat.chambre.numero_porte}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">
                        {locataire.contrat.chambre.maison_nom} · {locataire.contrat.chambre.quartier_nom}
                      </p>
                    </div>
                    <Badge type="neutre">
                      {TYPE_BIEN_LABEL[locataire.contrat.chambre.maison_type] ||
                        locataire.contrat.chambre.maison_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <span className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-base">
                      💳
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">
                        {formaterFcfa(locataire.contrat.loyer_mensuel)}/mois
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">
                        Échéance le {locataire.contrat.jour_echeance}
                      </p>
                    </div>
                    <Badge type={STATUT_PAIEMENT_BADGE[locataire.contrat.statut_paiement_mois]}>
                      {STATUT_PAIEMENT_LABEL[locataire.contrat.statut_paiement_mois] ||
                        locataire.contrat.statut_paiement_mois}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 ml-auto self-center">
                    Locataire depuis le {formaterDate(locataire.contrat.date_debut)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>🔒</span>
                  <span>
                    Caution : <strong>{formaterFcfa(locataire.contrat.caution_montant)}</strong> —{" "}
                    {CAUTION_STATUT_LABEL[locataire.contrat.caution_statut] ||
                      locataire.contrat.caution_statut}
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-100 bg-amber-50 px-4 py-2.5">
                <p className="text-xs text-amber-700">Aucun contrat actif — pas encore logé.</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {modalLocataire && (
        <FormulaireLocataire
          locataire={modalLocataire.locataire}
          onFermer={() => setModalLocataire(null)}
          onEnregistre={() => {
            setModalLocataire(null);
            charger();
          }}
        />
      )}

      {modalContrat && (
        <FormulaireContrat
          locataire={modalContrat.locataire}
          onFermer={() => setModalContrat(null)}
          onEnregistre={() => {
            setModalContrat(null);
            charger();
          }}
        />
      )}

      {modalCode && (
        <Modal ouvert={true} onFermer={() => setModalCode(null)} titre="Code d'accès généré">
          <p className="text-sm text-slate-600 mb-3">
            Transmets ce code à <strong>{modalCode.locataire.nom_complet}</strong> (par SMS ou
            oralement). Il l'utilisera avec son numéro <strong>{modalCode.locataire.telephone}</strong>{" "}
            pour créer son mot de passe et se connecter à son espace.
          </p>
          <div className="rounded-lg bg-slate-100 px-4 py-3 text-center mb-3">
            <p className="text-2xl font-semibold tracking-widest text-[#1F3A5F]">
              {modalCode.code}
            </p>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Valable jusqu'au {formaterDate(modalCode.expire)}. Ce code ne s'affichera plus après
            fermeture de cette fenêtre — génères-en un nouveau si besoin.
          </p>
          <button className={styleBoutonPrimaire} onClick={() => setModalCode(null)}>
            Fermer
          </button>
        </Modal>
      )}

      {modalTerminer && (
        <FormulaireTerminerContrat
          locataire={modalTerminer.locataire}
          onFermer={() => setModalTerminer(null)}
          onEnregistre={() => {
            setModalTerminer(null);
            charger();
          }}
        />
      )}

      <ConfirmerModal
        ouvert={!!locataireASupprimer}
        titre="Supprimer le locataire"
        message={
          locataireASupprimer
            ? `Supprimer le locataire "${locataireASupprimer.nom_complet}" ?`
            : ""
        }
        texteConfirmer="Supprimer"
        dangereux
        enCours={suppressionEnCours}
        onAnnuler={() => setLocataireASupprimer(null)}
        onConfirmer={confirmerSuppressionLocataire}
      />
    </div>
  );
}

function FormulaireLocataire({ locataire, onFermer, onEnregistre }) {
  const [nomComplet, setNomComplet] = useState(locataire?.nom_complet || "");
  const [telephone, setTelephone] = useState(locataire?.telephone || "");
  const [pieceIdentite, setPieceIdentite] = useState(locataire?.piece_identite_num || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const corps = {
        nom_complet: nomComplet,
        telephone,
        piece_identite_num: pieceIdentite || null,
      };
      if (locataire) {
        await api.put(`/location/locataires/${locataire.id}`, corps);
      } else {
        await api.post("/location/locataires", corps);
      }
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
      titre={locataire ? "Modifier le locataire" : "Ajouter un locataire"}
    >
      <form onSubmit={soumettre}>
        <Champ label="Nom complet">
          <input
            className={styleEntree}
            value={nomComplet}
            onChange={(e) => setNomComplet(e.target.value)}
            placeholder="Ex : Awa Ouédraogo"
            required
          />
        </Champ>
        <Champ label="Téléphone">
          <input
            className={styleEntree}
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="Ex : 70 12 34 56"
            required
          />
        </Champ>
        <Champ label="Numéro CNIB (optionnel)">
          <input
            className={styleEntree}
            placeholder="Ex. B12345678"
            value={pieceIdentite}
            onChange={(e) => setPieceIdentite(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">
            Une lettre suivie de 8 chiffres, comme imprimé sur la carte CNIB.
          </p>
        </Champ>
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

function FormulaireTerminerContrat({ locataire, onFermer, onEnregistre }) {
  const [dateFin, setDateFin] = useState(new Date().toISOString().slice(0, 10));
  const [cautionStatut, setCautionStatut] = useState(locataire.contrat.caution_statut || "detenue");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      await api.put(`/location/contrats/${locataire.contrat.id}/terminer`, {
        date_fin: dateFin,
        caution_statut: cautionStatut,
      });
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Impossible de terminer le contrat.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal ouvert={true} onFermer={onFermer} titre={`Terminer le contrat — ${locataire.nom_complet}`}>
      <p className="text-sm text-slate-500 mb-3">
        La chambre <strong>{locataire.contrat.chambre.numero_porte}</strong> redeviendra libre.
        Caution versée : <strong>{formaterFcfa(locataire.contrat.caution_montant)}</strong>.
      </p>
      <form onSubmit={soumettre}>
        <Champ label="Date de départ">
          <input
            type="date"
            className={styleEntree}
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            required
          />
        </Champ>
        <Champ label="Que devient la caution ?">
          <select
            className={styleEntree}
            value={cautionStatut}
            onChange={(e) => setCautionStatut(e.target.value)}
          >
            {Object.entries(CAUTION_STATUT_LABEL).map(([valeur, label]) => (
              <option key={valeur} value={valeur}>
                {label}
              </option>
            ))}
          </select>
        </Champ>
        {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
            Annuler
          </button>
          <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-50" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Terminer le contrat"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormulaireContrat({ locataire, onFermer, onEnregistre }) {
  const [chambres, setChambres] = useState([]);
  const [chambreId, setChambreId] = useState("");
  const [loyerMensuel, setLoyerMensuel] = useState("");
  const [jourEcheance, setJourEcheance] = useState("5");
  const [cautionMontant, setCautionMontant] = useState("0");
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [chargementChambres, setChargementChambres] = useState(true);

  useEffect(() => {
    api
      .get("/location/chambres-disponibles")
      .then(({ data }) => setChambres(data.chambres))
      .catch(() => setErreur("Impossible de charger les chambres disponibles."))
      .finally(() => setChargementChambres(false));
  }, []);

  function choisirChambre(id) {
    setChambreId(id);
    const chambre = chambres.find((c) => String(c.id) === String(id));
    if (chambre) setLoyerMensuel(String(chambre.prix_mensuel));
  }

  async function soumettre(e) {
    e.preventDefault();
    if (!chambreId) {
      setErreur("Choisis une chambre.");
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      await api.post("/location/contrats", {
        chambre_id: Number(chambreId),
        locataire_id: locataire.id,
        loyer_mensuel: Number(loyerMensuel),
        jour_echeance: Number(jourEcheance),
        caution_montant: Number(cautionMontant),
        date_debut: dateDebut,
      });
      onEnregistre();
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal ouvert={true} onFermer={onFermer} titre={`Créer un contrat — ${locataire.nom_complet}`}>
      {chargementChambres ? (
        <p className="text-sm text-slate-500">Chargement des chambres disponibles…</p>
      ) : chambres.length === 0 ? (
        <p className="text-sm text-amber-600">
          Aucune chambre libre pour l'instant. Va d'abord libérer ou créer une chambre dans
          l'onglet Biens.
        </p>
      ) : (
        <form onSubmit={soumettre}>
          <Champ label="Chambre">
            <select
              className={styleEntree}
              value={chambreId}
              onChange={(e) => choisirChambre(e.target.value)}
              required
            >
              <option value="">— Choisir —</option>
              {chambres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_porte} — {c.maison_nom} ({c.quartier_nom}) — {formaterFcfa(c.prix_mensuel)}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label="Loyer mensuel (FCFA)">
            <input
              type="number"
              min="0"
              className={styleEntree}
              value={loyerMensuel}
              onChange={(e) => setLoyerMensuel(e.target.value)}
              required
            />
          </Champ>
          <Champ label="Jour d'échéance du loyer (1-28)">
            <input
              type="number"
              min="1"
              max="28"
              className={styleEntree}
              value={jourEcheance}
              onChange={(e) => setJourEcheance(e.target.value)}
              required
            />
          </Champ>
          <Champ label="Caution (FCFA)">
            <input
              type="number"
              min="0"
              className={styleEntree}
              value={cautionMontant}
              onChange={(e) => setCautionMontant(e.target.value)}
            />
          </Champ>
          <Champ label="Date de début">
            <input
              type="date"
              className={styleEntree}
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              required
            />
          </Champ>
          {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
              {enCours ? "Enregistrement…" : "Créer le contrat"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
