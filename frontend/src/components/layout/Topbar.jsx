import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import ConfirmerModal from "../ui/ConfirmerModal.jsx";

export default function Topbar({ titre, onOuvrirMenu }) {
  const { bailleur, deconnecter, mettreAJourBailleur } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [photoErreur, setPhotoErreur] = useState("");
  const [confirmerRetraitPhoto, setConfirmerRetraitPhoto] = useState(false);
  const [retraitPhotoEnCours, setRetraitPhotoEnCours] = useState(false);
  const inputPhotoRef = useRef(null);
  const navigate = useNavigate();

  const initiale = bailleur?.nom_complet?.trim()?.[0]?.toUpperCase() || "B";

  function seDeconnecter() {
    deconnecter();
    navigate("/connexion", { replace: true });
  }

  async function changerPhoto(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const donneesForm = new FormData();
    donneesForm.append("photo", fichier);
    setPhotoEnCours(true);
    setPhotoErreur("");
    try {
      const { data } = await api.post("/auth/ma-photo", donneesForm);
      mettreAJourBailleur({ photo_url: data.photo_url });
    } catch (err) {
      setPhotoErreur(err.response?.data?.error || "Envoi de la photo impossible.");
    } finally {
      setPhotoEnCours(false);
      if (inputPhotoRef.current) inputPhotoRef.current.value = "";
    }
  }

  async function confirmerRetirerPhoto() {
    setRetraitPhotoEnCours(true);
    setPhotoErreur("");
    try {
      await api.delete("/auth/ma-photo");
      mettreAJourBailleur({ photo_url: null });
      setConfirmerRetraitPhoto(false);
    } catch (err) {
      setPhotoErreur(err.response?.data?.error || "Suppression impossible.");
      setConfirmerRetraitPhoto(false);
    } finally {
      setRetraitPhotoEnCours(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-8 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOuvrirMenu}
          className="md:hidden -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Ouvrir le menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <h1 className="text-lg md:text-xl font-semibold text-slate-800 truncate">{titre}</h1>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0 group">
            <button
              type="button"
              onClick={() => setMenuOuvert((o) => !o)}
              className="block h-9 w-9 rounded-full overflow-hidden"
            >
              {bailleur?.photo_url ? (
                <img
                  src={bailleur.photo_url}
                  alt="Ma photo de profil"
                  className="h-9 w-9 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-[#1F3A5F] text-white flex items-center justify-center text-sm font-medium">
                  {initiale}
                </div>
              )}
            </button>
            <label
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#1F3A5F] text-white text-[10px] flex items-center justify-center cursor-pointer border-2 border-white"
              aria-label="Changer ma photo"
            >
              {photoEnCours ? "…" : "✎"}
              <input
                ref={inputPhotoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={changerPhoto}
                disabled={photoEnCours}
              />
            </label>
            {bailleur?.photo_url && (
              <button
                type="button"
                onClick={() => setConfirmerRetraitPhoto(true)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Retirer ma photo"
              >
                ×
              </button>
            )}
          </div>
          <button
            className="hidden sm:flex items-center"
            onClick={() => setMenuOuvert((o) => !o)}
          >
            {bailleur?.nom_complet && (
              <span className="text-sm text-slate-600">{bailleur.nom_complet}</span>
            )}
          </button>
        </div>

        {photoErreur && (
          <p className="absolute right-0 mt-1 w-56 text-xs text-rose-600 text-right">{photoErreur}</p>
        )}

        {menuOuvert && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
            <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-20 py-1">
              <button
                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                onClick={seDeconnecter}
              >
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmerModal
        ouvert={confirmerRetraitPhoto}
        titre="Retirer ma photo"
        message="Retirer ta photo de profil ?"
        texteConfirmer="Retirer"
        dangereux
        enCours={retraitPhotoEnCours}
        onAnnuler={() => setConfirmerRetraitPhoto(false)}
        onConfirmer={confirmerRetirerPhoto}
      />
    </header>
  );
}
