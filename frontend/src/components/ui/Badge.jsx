const STYLES = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  erreur: "bg-rose-100 text-rose-700",
  neutre: "bg-slate-100 text-slate-600",
};

export default function Badge({ children, type = "neutre" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[type] ?? STYLES.neutre}`}
    >
      {children}
    </span>
  );
}
