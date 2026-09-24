import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Champ, { styleEntree, styleBoutonPrimaire } from "../components/ui/Champ.jsx";

export default function Connexion() {
  const [mode, setMode] = useState("connexion"); // "connexion" | "inscription"
  const [nomComplet, setNomComplet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const { connecter } = useAuth();
  const navigate = useNavigate();

  async function soumettre(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const chemin = mode === "inscription" ? "/auth/inscription" : "/auth/connexion";
      const corps =
        mode === "inscription"
          ? { nom_complet: nomComplet, telephone, email: email || undefined, mot_de_passe: motDePasse }
          : { telephone, mot_de_passe: motDePasse };

      const { data } = await api.post(chemin, corps);
      connecter(data.jeton, data.bailleur);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response) {
        // Le backend a répondu avec un message d'erreur précis (ex: téléphone déjà utilisé).
        setErreur(err.response.data?.error || `Erreur ${err.response.status}.`);
      } else if (err.request) {
        // La requête n'a jamais eu de réponse : le backend n'est probablement pas lancé.
        setErreur(
          "Impossible de contacter le serveur. Vérifie que le backend tourne bien (`npm run dev` dans le dossier backend/), puis réessaie."
        );
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
          <p className="text-xl font-semibold text-[#1F3A5F]">Gestion Locative</p>
          <p className="text-sm text-slate-500">Espace bailleur</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex mb-5 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                mode === "connexion" ? "bg-white shadow text-[#1F3A5F]" : "text-slate-500"
              }`}
              onClick={() => setMode("connexion")}
            >
              Se connecter
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                mode === "inscription" ? "bg-white shadow text-[#1F3A5F]" : "text-slate-500"
              }`}
              onClick={() => setMode("inscription")}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={soumettre}>
            {mode === "inscription" && (
              <Champ label="Nom complet">
                <input
                  className={styleEntree}
                  value={nomComplet}
                  onChange={(e) => setNomComplet(e.target.value)}
                  placeholder="Ex. Aminata Ouédraogo"
                  required
                />
              </Champ>
            )}
            <Champ label="Téléphone">
              <input
                className={styleEntree}
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex. 70 00 00 00"
                required
              />
            </Champ>
            {mode === "inscription" && (
              <Champ label="Email (optionnel)">
                <input
                  className={styleEntree}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                />
              </Champ>
            )}
            <Champ label="Mot de passe">
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

            {erreur && <p className="text-xs text-rose-600 mb-3">{erreur}</p>}

            <button type="submit" className={`${styleBoutonPrimaire} w-full mt-1`} disabled={enCours}>
              {enCours
                ? "Veuillez patienter..."
                : mode === "inscription"
                  ? "Créer le compte"
                  : "Se connecter"}
            </button>

            {mode === "connexion" && (
              <div className="text-center mt-4">
                <Link
                  to="/mot-de-passe-oublie"
                  className="text-xs font-medium text-slate-500 hover:text-[#1F3A5F]"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
