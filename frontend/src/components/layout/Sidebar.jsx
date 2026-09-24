import { NavLink } from "react-router-dom";

const liens = [
  { to: "/", label: "Tableau de bord", icone: "📊", fin: true },
  { to: "/biens", label: "Biens", icone: "🏠" },
  { to: "/locataires", label: "Locataires", icone: "👤" },
  { to: "/paiements", label: "Paiements", icone: "💳" },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[#1F3A5F] text-white min-h-screen">
      <div className="px-6 py-6 border-b border-white/10">
        <p className="text-lg font-semibold leading-tight">Gestion Locative</p>
        <p className="text-xs text-white/60">Espace bailleur</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {liens.map((lien) => (
          <NavLink
            key={lien.to}
            to={lien.to}
            end={lien.fin}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <span aria-hidden="true">{lien.icone}</span>
            {lien.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
