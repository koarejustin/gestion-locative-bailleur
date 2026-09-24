import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import Sidebar, { NavLiens } from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function Layout({ titre, children }) {
  const location = useLocation();
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);

  // Referme le tiroir mobile automatiquement après chaque changement de page.
  useEffect(() => {
    setMenuMobileOuvert(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[#F4F6F9]">
      <Sidebar />

      {/* Menu mobile : tiroir coulissant avec fond assombri, affiché uniquement
          sous le point de rupture "md" (voir le bouton ☰ dans Topbar.jsx). */}
      <AnimatePresence>
        {menuMobileOuvert && (
          <div className="md:hidden">
            <motion.div
              className="fixed inset-0 z-30 bg-slate-900/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuMobileOuvert(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#1F3A5F] text-white shadow-2xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
                <div>
                  <p className="text-lg font-semibold leading-tight">Gestion Locative</p>
                  <p className="text-xs text-white/60">Espace bailleur</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuMobileOuvert(false)}
                  className="text-white/70 hover:text-white text-2xl leading-none px-1"
                  aria-label="Fermer le menu"
                >
                  ×
                </button>
              </div>
              <NavLiens onNaviguer={() => setMenuMobileOuvert(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar titre={titre} onOuvrirMenu={() => setMenuMobileOuvert(true)} />
        <main className="flex-1 p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
