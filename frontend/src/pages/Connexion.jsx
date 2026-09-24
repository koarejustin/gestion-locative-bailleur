import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Champ, { styleEntree, styleBoutonPrimaire } from "../components/ui/Champ.jsx";

// Petites bulles décoratives, animées en arrière-plan — purement visuel,
// pour donner un peu de vie à l'écran de connexion sans gêner la lecture.
function BullesDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#1F3A5F]/10 blur-3xl"
        animate={{ x: [0, 20, 0], y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#2E7D32]/10 blur-3xl"
        animate={{ x: [0, -20, 0], y: [0, -15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

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
    <div className="relative min-h-screen flex items-center justify-center bg-[#F4F6F9] px-4 py-10 overflow-hidden">
      <BullesDecor />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <motion.div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1F3A5F] text-white shadow-lg shadow-[#1F3A5F]/20"
            initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: "backOut", delay: 0.05 }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 10.5 12 3l9 7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 9.5V20a1 1 0 0 0 1 1h4v-5a2 2 0 1 1 4 0v5h4a1 1 0 0 0 1-1V9.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
          <p className="text-xl font-semibold text-[#1F3A5F]">Gestion Locative</p>
          <p className="text-sm text-slate-500">Espace bailleur</p>
        </motion.div>

        <motion.div
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:shadow-xl sm:shadow-slate-200/60"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="relative flex mb-5 rounded-lg bg-slate-100 p-1 text-sm">
            {["connexion", "inscription"].map((valeur) => (
              <button
                key={valeur}
                type="button"
                className={`relative z-10 flex-1 rounded-md py-1.5 font-medium transition-colors ${
                  mode === valeur ? "text-[#1F3A5F]" : "text-slate-500"
                }`}
                onClick={() => setMode(valeur)}
              >
                {mode === valeur && (
                  <motion.span
                    layoutId="pastille-mode"
                    className="absolute inset-0 rounded-md bg-white shadow"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                {valeur === "connexion" ? "Se connecter" : "Créer un compte"}
              </button>
            ))}
          </div>

          <motion.form layout onSubmit={soumettre} transition={{ duration: 0.25, ease: "easeInOut" }}>
            <AnimatePresence initial={false}>
              {mode === "inscription" && (
                <motion.div
                  key="nom_complet"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <Champ label="Nom complet">
                    <input
                      className={styleEntree}
                      value={nomComplet}
                      onChange={(e) => setNomComplet(e.target.value)}
                      placeholder="Ex. Aminata Ouédraogo"
                      required
                    />
                  </Champ>
                </motion.div>
              )}
            </AnimatePresence>

            <Champ label="Téléphone">
              <input
                className={styleEntree}
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex. 70 00 00 00"
                required
              />
            </Champ>

            <AnimatePresence initial={false}>
              {mode === "inscription" && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <Champ label="Email (optionnel)">
                    <input
                      className={styleEntree}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="toi@exemple.com"
                    />
                  </Champ>
                </motion.div>
              )}
            </AnimatePresence>

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

            <AnimatePresence initial={false}>
              {erreur && (
                <motion.p
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-rose-600 mb-3 overflow-hidden"
                >
                  {erreur}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              className={`${styleBoutonPrimaire} w-full mt-1`}
              disabled={enCours}
              whileHover={enCours ? {} : { scale: 1.015 }}
              whileTap={enCours ? {} : { scale: 0.98 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={enCours ? "chargement" : mode}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {enCours
                    ? "Veuillez patienter..."
                    : mode === "inscription"
                      ? "Créer le compte"
                      : "Se connecter"}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {mode === "connexion" && (
              <div className="text-center mt-4">
                <Link
                  to="/mot-de-passe-oublie"
                  className="text-xs font-medium text-slate-500 hover:text-[#1F3A5F] transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            )}
          </motion.form>
        </motion.div>
      </motion.div>
    </div>
  );
}
