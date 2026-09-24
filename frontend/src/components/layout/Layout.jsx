import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function Layout({ titre, children }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-[#F4F6F9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar titre={titre} />
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
