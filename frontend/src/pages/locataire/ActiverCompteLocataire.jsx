import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/client.js";
import { useAuthLocataire } from "../../auth/AuthContextLocataire.jsx";
import Champ, { styleEntree, styleBoutonPrimaire } from "../../components/ui/Champ.jsx";

export default function ActiverCompteLocataire() {
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const { connecter } = useAuthLocataire();
  const navigate = useNavigate();

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");

    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setEnCours(true);
    try {
      const { data } = await api.post("/auth/locataire/activer", {
        telephone,
        code,
        mot_de_passe: motDePasse,
      });
      connecter(data.jeton, data.locataire);
      navigate("/locataire", { replace: true });
    } catch (err) {
      if (err.response) {
        setErreur(err.response.data?.error || `Erreur ${err.response.status}.`);
      } else if (err.request) {
        setErreur("Impossible de contacter le serveur. Réessaie dans un instant.");
      } else {
        setErreur(err.message || "Une erreur est survenue.");
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <p className="text-xl font-semibold text-[#1F3A5F]">Activer mon compte</p>
          <p className="text-sm text-slate-500">
            Utilise le code à 6 chiffres transmis par ton bailleur, et choisis ton mot de passe.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={soumettre}>
            <Champ label="Téléphone">
              <input
                className={styleEntree}
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex. 70 12 34 56"
                required
              />
            </Champ>
            <Champ label="Code d'accès">
              <input
                className={styleEntree}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex. 123456"
                inputMode="numeric"
                required
              />
            </Champ>
            <Champ label="Choisis un mot de passe">
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

            {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}

            <button type="submit" className={`${styleBoutonPrimaire} w-full mt-1`} disabled={enCours}>
              {enCours ? "Veuillez patienter..." : "Activer mon compte"}
            </button>
          </form>

          <div className="text-center mt-5">
            <Link
              to="/locataire/connexion"
              className="text-xs font-medium text-slate-500 hover:text-[#1F3A5F]"
            >
              ← Déjà activé ? Se connecter
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
