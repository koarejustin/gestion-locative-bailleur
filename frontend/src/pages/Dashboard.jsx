import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Card from "../components/ui/Card.jsx";

function formaterFcfa(montant) {
  return `${Number(montant).toLocaleString("fr-FR")} FCFA`;
}

export default function Dashboard() {
  const { bailleur } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    occupees: "—",
    libres: "—",
    enRetard: "—",
    encaisseMois: "—",
  });
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;

    api
      .get("/biens")
      .then(({ data }) => {
        if (annule) return;
        const chambres = data.quartiers.flatMap((q) => q.maisons.flatMap((m) => m.chambres));
        const occupees = chambres.filter((c) => c.statut === "occupee").length;
        const libres = chambres.filter((c) => c.statut === "libre").length;
        setStats((s) => ({ ...s, occupees, libres }));
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de charger tes données pour le moment.");
      });

    api
      .get("/paiements/resume")
      .then(({ data }) => {
        if (annule) return;
        setStats((s) => ({
          ...s,
          enRetard: data.en_retard,
          encaisseMois: formaterFcfa(data.total_verse),
        }));
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de charger tes données pour le moment.");
      });

    return () => {
      annule = true;
    };
  }, []);

  const prenom = bailleur?.nom_complet?.split(" ")[0] || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">
          {prenom ? `Bonjour, ${prenom}` : "Tableau de bord"}
        </h1>
        <p className="text-sm text-slate-500">Vue d'ensemble de tes biens et de tes loyers.</p>
      </div>

      {erreur && (
        <Card className="border-rose-200 bg-rose-50">
          <p className="text-sm text-rose-700">{erreur}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Chambres occupées"
          valeur={stats.occupees}
          delai={0}
          sousTexte="Voir qui occupe quoi"
          onClick={() => navigate("/locataires")}
        />
        <StatCard
          label="Chambres libres"
          valeur={stats.libres}
          delai={0.05}
          accent="#2E7D32"
          sousTexte="Voir les biens"
          onClick={() => navigate("/biens")}
        />
        <StatCard
          label="Loyers en retard"
          valeur={stats.enRetard}
          delai={0.1}
          accent="#B8860B"
          sousTexte="Voir le détail"
          onClick={() => navigate("/paiements")}
        />
        <StatCard
          label="Encaissé ce mois"
          valeur={stats.encaisseMois}
          delai={0.15}
          sousTexte="Voir les transactions"
          onClick={() => navigate("/paiements")}
        />
      </div>
    </div>
  );
}
