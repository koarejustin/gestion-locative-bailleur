import { useEffect, useState } from "react";
import { styleBoutonSecondaire } from "../components/ui/Champ.jsx";
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

  function cleBanniereMasquee() {
    return `banniere-email-masquee-${bailleur?.id}`;
  }
  function banniereDejaMasquee() {
    try {
      return localStorage.getItem(cleBanniereMasquee()) === "1";
    } catch {
      return false;
    }
  }

  const [banniereEmail, setBanniereEmail] = useState(
    bailleur?.email && !bailleur?.email_verifie && !banniereDejaMasquee() ? "a_verifier" : null
  );

  function renvoyerVerification() {
    setBanniereEmail("envoi_en_cours");
    api
      .post("/auth/renvoyer-verification")
      .then(() => setBanniereEmail("envoye"))
      .catch(() => setBanniereEmail("erreur"));
  }

  function masquerBanniere() {
    try {
      localStorage.setItem(cleBanniereMasquee(), "1");
    } catch {
      // localStorage indisponible : la bannière réapparaîtra simplement au prochain chargement.
    }
    setBanniereEmail(null);
  }

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
  const lienVitrine = `${window.location.origin}/louer`;
  const [lienCopie, setLienCopie] = useState(false);

  function copierLienVitrine() {
    navigator.clipboard
      ?.writeText(lienVitrine)
      .then(() => {
        setLienCopie(true);
        setTimeout(() => setLienCopie(false), 2000);
      })
      .catch(() => {});
  }

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

      {banniereEmail && banniereEmail !== "envoye" && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-amber-800">
              {banniereEmail === "erreur"
                ? "L'envoi a échoué, réessaie dans un instant."
                : `Ton adresse email (${bailleur.email}) n'est pas encore vérifiée. Vérifie-la pour pouvoir récupérer ton mot de passe par email.`}
            </p>
            <div className="flex items-center gap-3 whitespace-nowrap">
              <button
                onClick={renvoyerVerification}
                disabled={banniereEmail === "envoi_en_cours"}
                className="text-xs font-medium text-amber-800 underline hover:no-underline disabled:opacity-50"
              >
                {banniereEmail === "envoi_en_cours" ? "Envoi..." : "Renvoyer l'email de vérification"}
              </button>
              <button
                onClick={masquerBanniere}
                title="Ne plus afficher"
                className="text-amber-800/60 hover:text-amber-800 text-sm leading-none px-1"
              >
                ✕
              </button>
            </div>
          </div>
        </Card>
      )}
      {banniereEmail === "envoye" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            Email de vérification renvoyé — pense à vérifier tes spams.
          </p>
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

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-700">Vitrine publique</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Partage ce lien aux prospects — ils y consultent les biens libres, candidatent et signent leur
              contrat directement en ligne.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={copierLienVitrine} className={styleBoutonSecondaire}>
              {lienCopie ? "Copié !" : "Copier le lien"}
            </button>
            <a href="/louer" target="_blank" rel="noopener" className={styleBoutonSecondaire}>
              Ouvrir
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
