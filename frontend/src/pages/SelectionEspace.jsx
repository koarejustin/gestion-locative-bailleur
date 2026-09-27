import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Petites bulles décoratives, animées en arrière-plan — même effet que sur
// les écrans de connexion, pour garder une identité visuelle cohérente.
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

function IconeMaison() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  );
}

function IconePersonne() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Écran d'accueil : que ce soit le bailleur ou un de ses locataires qui
// ouvre le site, on demande d'abord quel espace il veut — chacun a son
// propre compte et son propre mot de passe, aucun lien direct entre les
// deux formulaires de connexion.
export default function SelectionEspace() {
  const navigate = useNavigate();

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
            <IconeMaison />
          </motion.div>
          <p className="text-xl font-semibold text-[#1F3A5F]">Gestion Locative</p>
          <p className="text-sm text-slate-500">Choisis ton espace</p>
        </motion.div>

        <div className="space-y-3">
          <motion.button
            type="button"
            onClick={() => navigate("/connexion")}
            className="w-full flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm sm:shadow-xl sm:shadow-slate-200/60 hover:border-[#1F3A5F]/40 transition-colors"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1F3A5F]/10 text-[#1F3A5F]">
              <IconeMaison />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">Espace bailleur</span>
              <span className="block text-xs text-slate-500">Biens, locataires et paiements</span>
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => navigate("/locataire/connexion")}
            className="w-full flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm sm:shadow-xl sm:shadow-slate-200/60 hover:border-[#2E7D32]/40 transition-colors"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2E7D32]/10 text-[#2E7D32]">
              <IconePersonne />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">Espace locataire</span>
              <span className="block text-xs text-slate-500">Mon logement et mes paiements</span>
            </span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
