import Modal from "./Modal.jsx";
import { styleBoutonPrimaire, styleBoutonSecondaire } from "./Champ.jsx";

const styleBoutonDanger =
  "inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-50";

// Remplace window.confirm() par une fenêtre habillée comme le reste de
// l'appli — un popup natif du navigateur passe facilement pour un bug ou un
// message sans rapport avec l'application.
export default function ConfirmerModal({
  ouvert,
  titre = "Confirmer",
  message,
  texteConfirmer = "Confirmer",
  dangereux = false,
  enCours = false,
  onAnnuler,
  onConfirmer,
}) {
  return (
    <Modal ouvert={ouvert} onFermer={onAnnuler} titre={titre}>
      <p className="text-sm text-slate-600 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={styleBoutonSecondaire} onClick={onAnnuler} disabled={enCours}>
          Annuler
        </button>
        <button
          type="button"
          className={dangereux ? styleBoutonDanger : styleBoutonPrimaire}
          onClick={onConfirmer}
          disabled={enCours}
        >
          {enCours ? "..." : texteConfirmer}
        </button>
      </div>
    </Modal>
  );
}
