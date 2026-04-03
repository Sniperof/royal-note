export default function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}
