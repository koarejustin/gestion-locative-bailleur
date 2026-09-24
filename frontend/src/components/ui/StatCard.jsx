import { motion } from "framer-motion";
import Card from "./Card.jsx";

// Si onClick est fourni, la carte devient un vrai bouton cliquable (pour
// amener vers la page détaillée correspondante) avec un indice visuel discret.
export default function StatCard({ label, valeur, accent = "#1F3A5F", delai = 0, onClick, sousTexte }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delai, ease: "easeOut" }}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full text-left group">
          <Card className="transition-shadow group-hover:shadow-md group-hover:border-slate-300">
            <div className="flex items-start justify-between">
              <p className="text-sm text-slate-500">{label}</p>
              <span className="text-slate-300 group-hover:text-slate-400 transition-colors text-xs">▸</span>
            </div>
            <p className="mt-2 text-2xl font-semibold" style={{ color: accent }}>
              {valeur}
            </p>
            {sousTexte && <p className="mt-1 text-xs text-slate-400">{sousTexte}</p>}
          </Card>
        </button>
      ) : (
        <Card>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: accent }}>
            {valeur}
          </p>
          {sousTexte && <p className="mt-1 text-xs text-slate-400">{sousTexte}</p>}
        </Card>
      )}
    </motion.div>
  );
}
