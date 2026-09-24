import { AnimatePresence, motion } from "framer-motion";

export default function Modal({ ouvert, onFermer, titre, children }) {
  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onFermer}
        >
          <motion.div
            className="w-full max-w-md my-auto rounded-xl bg-white p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">{titre}</h2>
              <button
                onClick={onFermer}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Fermer"
                type="button"
              >
                &times;
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
