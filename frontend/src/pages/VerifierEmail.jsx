import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { styleBoutonPrimaire } from "../components/ui/Champ.jsx";

export default function VerifierEmail() {
  const [searchParams] = useSearchParams();
  const [statut, setStatut] = useState("en_cours"); // en_cours | ok | erreur
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = searchParams.get("id");
    const token = searchParams.get("token");

    if (!id || !token) {
      setStatut("erreur");
      setMessage("Lien de vérification invalide.");
      return;
    }

    api
      .post("/auth/verifier-email", { id: Number(id), token })
      .then(({ data }) => {
        setStatut("ok");
        setMessage(
          data.deja_verifie ? "Cette adresse email était déjà vérifiée." : "Email vérifié avec succès !"
        );
      })
      .catch((err) => {
        setStatut("erreur");
        setMessage(err.response?.data?.error || "Impossible de vérifier cet email.");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          {statut === "en_cours" && <p className="text-sm text-slate-500">Vérification en cours...</p>}
          {statut === "ok" && (
            <>
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm text-slate-700">{message}</p>
            </>
          )}
          {statut === "erreur" && (
            <>
              <p className="text-3xl mb-2">⚠️</p>
              <p className="text-sm text-rose-600">{message}</p>
            </>
          )}
          <Link to="/connexion" className={`${styleBoutonPrimaire} w-full mt-5`}>
            Aller à la connexion
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
