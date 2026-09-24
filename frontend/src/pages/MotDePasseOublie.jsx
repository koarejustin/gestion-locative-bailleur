import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import Champ, { styleEntree, styleBoutonPrimaire } from "../components/ui/Champ.jsx";

export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    setMessage("");
    try {
      const { data } = await api.post("/auth/mot-de-passe-oublie", { email });
      setMessage(data.message);
    } catch (err) {
      setErreur(err.response?.data?.error || "Une erreur est survenue. Réessaie.");
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
          <p className="text-xl font-semibold text-[#1F3A5F]">Mot de passe oublié</p>
          <p className="text-sm text-slate-500">
            Entre l'email vérifié de ton compte, on t'envoie un nouveau mot de passe.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {message ? (
            <div className="text-sm text-slate-700">
              <p>{message}</p>
              <p className="mt-3 text-xs text-slate-500">
                Rien reçu après quelques minutes ? Vérifie que c'est bien l'email que tu as
                renseigné et vérifié à l'inscription (dossier spam inclus).
              </p>
            </div>
          ) : (
            <form onSubmit={soumettre}>
              <Champ label="Email">
                <input
                  className={styleEntree}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  required
                />
              </Champ>
              {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}
              <button type="submit" className={`${styleBoutonPrimaire} w-full mt-1`} disabled={enCours}>
                {enCours ? "Envoi en cours..." : "Envoyer un nouveau mot de passe"}
              </button>
              <p className="text-xs text-slate-400 mt-3">
                La récupération par SMS (numéro de téléphone) arrive bientôt. Pour l'instant, elle
                fonctionne uniquement avec un email vérifié.
              </p>
            </form>
          )}

          <div className="text-center mt-5">
            <Link to="/connexion" className="text-xs font-medium text-slate-500 hover:text-[#1F3A5F]">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
