import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal.jsx";
import Champ, { styleEntree, styleBoutonPrimaire, styleBoutonSecondaire } from "../../components/ui/Champ.jsx";
import api from "../../api/client.js";
import { useAuthLocataire } from "../../auth/AuthContextLocataire.jsx";

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

const TITRES_ETAPE = {
  identite: "Ça m'intéresse",
  code: "Vérifie ton email",
  signature: "Signature du contrat",
  succes: "Contrat signé !",
};

// Petit assistant en 3 étapes : identité -> code reçu par email -> signature
// électronique (nom tapé + case d'acceptation + mot de passe pour l'espace
// locataire). La signature crée directement le compte + le contrat, et
// connecte automatiquement le nouveau locataire.
export default function CandidatureModal({ unite, onFermer }) {
  const [etape, setEtape] = useState("identite");
  const [candidatureId, setCandidatureId] = useState(null);
  const [recap, setRecap] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [nomComplet, setNomComplet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [cnib, setCnib] = useState("");
  const [dateDebut, setDateDebut] = useState("");

  const [code, setCode] = useState("");

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nomSignature, setNomSignature] = useState("");
  const [accepteConditions, setAccepteConditions] = useState(false);

  const { connecter } = useAuthLocataire();
  const navigate = useNavigate();

  // Réinitialise tout à chaque nouvelle unité choisie (ou fermeture).
  useEffect(() => {
    setEtape("identite");
    setCandidatureId(null);
    setRecap(null);
    setErreur("");
    setNomComplet("");
    setTelephone("");
    setEmail("");
    setCnib("");
    setDateDebut("");
    setCode("");
    setMotDePasse("");
    setConfirmation("");
    setNomSignature("");
    setAccepteConditions(false);
  }, [unite]);

  function gererErreur(err) {
    if (err.response) setErreur(err.response.data?.error || `Erreur ${err.response.status}.`);
    else if (err.request) setErreur("Impossible de contacter le serveur. Réessaie dans un instant.");
    else setErreur(err.message || "Une erreur est survenue.");
  }

  async function soumettreIdentite(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      const { data } = await api.post("/public/candidatures", {
        chambre_id: unite.chambre.id,
        nom_complet: nomComplet,
        telephone,
        email,
        piece_identite_num: cnib || undefined,
        date_debut_souhaitee: dateDebut || undefined,
      });
      setCandidatureId(data.candidature_id);
      setEtape("code");
    } catch (err) {
      gererErreur(err);
    } finally {
      setEnCours(false);
    }
  }

  async function renvoyerCode() {
    setErreur("");
    setEnCours(true);
    try {
      await api.post(`/public/candidatures/${candidatureId}/renvoyer-code`);
      setErreur("");
    } catch (err) {
      gererErreur(err);
    } finally {
      setEnCours(false);
    }
  }

  async function soumettreCode(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      const { data } = await api.post(`/public/candidatures/${candidatureId}/verifier`, { code });
      setRecap(data.recap);
      setEtape("signature");
    } catch (err) {
      gererErreur(err);
    } finally {
      setEnCours(false);
    }
  }

  async function soumettreSignature(e) {
    e.preventDefault();
    setErreur("");
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnCours(true);
    try {
      const { data } = await api.post(`/public/candidatures/${candidatureId}/signer`, {
        mot_de_passe: motDePasse,
        confirmation_mot_de_passe: confirmation,
        nom_signature: nomSignature,
        accepte_conditions: accepteConditions,
      });
      connecter(data.jeton, data.locataire);
      setEtape("succes");
    } catch (err) {
      gererErreur(err);
    } finally {
      setEnCours(false);
    }
  }

  if (!unite) return null;

  return (
    <Modal ouvert={!!unite} onFermer={onFermer} titre={TITRES_ETAPE[etape]}>
      <div className="rounded-lg bg-slate-50 px-3 py-2 mb-4 text-xs text-slate-600">
        {unite.maison.usage_bien === "commerce" ? "Boutique" : "Porte"} {unite.chambre.numero_porte} —{" "}
        {unite.maison.nom}, {unite.quartier.nom} · {formaterFcfa(unite.chambre.prix_mensuel)}/mois
      </div>

      {etape === "identite" && (
        <form onSubmit={soumettreIdentite}>
          <Champ label="Nom complet">
            <input
              className={styleEntree}
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              placeholder="Ex. Awa Ouédraogo"
              autoFocus
              required
            />
          </Champ>
          <Champ label="Téléphone">
            <input
              className={styleEntree}
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="Ex. 70 12 34 56"
              required
            />
          </Champ>
          <Champ label="Email (pour recevoir le code de vérification)">
            <input
              className={styleEntree}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@example.com"
              required
            />
          </Champ>
          <Champ label="Numéro CNIB (optionnel)">
            <input
              className={styleEntree}
              value={cnib}
              onChange={(e) => setCnib(e.target.value)}
              placeholder="Ex. B12345678"
            />
          </Champ>
          <Champ label="Date d'entrée souhaitée (optionnel)">
            <input
              className={styleEntree}
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </Champ>

          {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
              {enCours ? "Envoi..." : "Continuer"}
            </button>
          </div>
        </form>
      )}

      {etape === "code" && (
        <form onSubmit={soumettreCode}>
          <p className="text-sm text-slate-600 mb-3">
            Un code à 6 chiffres vient d'être envoyé à <strong>{email}</strong>.
          </p>
          <Champ label="Code reçu par email">
            <input
              className={styleEntree}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex. 123456"
              inputMode="numeric"
              autoFocus
              required
            />
          </Champ>

          {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}

          <button
            type="button"
            onClick={renvoyerCode}
            className="text-xs font-medium text-slate-500 hover:text-[#1F3A5F] mb-3"
            disabled={enCours}
          >
            Je n'ai rien reçu — renvoyer le code
          </button>

          <div className="flex justify-end gap-2 mt-1">
            <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
              {enCours ? "Vérification..." : "Confirmer"}
            </button>
          </div>
        </form>
      )}

      {etape === "signature" && recap && (
        <form onSubmit={soumettreSignature}>
          <div className="rounded-lg border border-slate-200 p-3 mb-4 text-sm">
            <p className="font-medium text-slate-800">
              {recap.maison_nom} — Porte {recap.numero_porte}
            </p>
            <p className="text-slate-500">{recap.quartier_nom}</p>
            <div className="flex justify-between mt-2 text-slate-600">
              <span>Loyer mensuel</span>
              <span className="font-medium text-slate-800">{formaterFcfa(recap.loyer_mensuel)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Caution</span>
              <span className="font-medium text-slate-800">{formaterFcfa(recap.caution_montant)}</span>
            </div>
          </div>

          <Champ label="Choisis un mot de passe (pour ton espace locataire)">
            <input
              className={styleEntree}
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="Au moins 6 caractères"
              minLength={6}
              required
            />
          </Champ>
          <Champ label="Confirme le mot de passe">
            <input
              className={styleEntree}
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Retape le même mot de passe"
              minLength={6}
              required
            />
          </Champ>
          <Champ label="Tape ton nom complet pour signer">
            <input
              className={styleEntree}
              value={nomSignature}
              onChange={(e) => setNomSignature(e.target.value)}
              placeholder={nomComplet || "Ton nom complet"}
              required
            />
          </Champ>
          <label className="flex items-start gap-2 text-xs text-slate-600 mb-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={accepteConditions}
              onChange={(e) => setAccepteConditions(e.target.checked)}
              required
            />
            <span>
              Je confirme avoir vérifié les informations ci-dessus et j'accepte de signer ce contrat de location
              électroniquement.
            </span>
          </label>

          {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}

          <div className="flex justify-end gap-2 mt-1">
            <button type="button" className={styleBoutonSecondaire} onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className={styleBoutonPrimaire} disabled={enCours}>
              {enCours ? "Signature..." : "Signer le contrat"}
            </button>
          </div>
        </form>
      )}

      {etape === "succes" && (
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Ton contrat est signé et ton espace locataire est prêt. Tu peux dès maintenant consulter ton logement,
            suivre tes paiements, et déclarer un versement depuis ton numéro.
          </p>
          <button
            className={`${styleBoutonPrimaire} w-full`}
            onClick={() => {
              onFermer();
              navigate("/locataire");
            }}
          >
            Aller à mon espace locataire
          </button>
        </div>
      )}
    </Modal>
  );
}
