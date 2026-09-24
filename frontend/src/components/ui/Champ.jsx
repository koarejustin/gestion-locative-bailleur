export default function Champ({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const styleEntree =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/30 focus:border-[#1F3A5F]";
export const styleBoutonPrimaire =
  "inline-flex items-center justify-center rounded-lg bg-[#1F3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#16283f] transition-colors disabled:opacity-50";
export const styleBoutonSecondaire =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors";
export const styleBoutonTexte =
  "text-xs font-medium text-slate-500 hover:text-[#1F3A5F] transition-colors";
