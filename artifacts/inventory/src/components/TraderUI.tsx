import type { ReactNode } from "react";

type TraderPanelCardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

type TraderStatChipProps = {
  icon?: ReactNode;
  label: string;
  className?: string;
};

type TraderEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
};

export function TraderPanelCard({ title, children, className = "" }: TraderPanelCardProps) {
  return (
    <div className={`rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm ${className}`.trim()}>
      {title ? (
        <p className="font-headline text-[11px] font-bold uppercase tracking-[0.22em] text-slate-900">{title}</p>
      ) : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </div>
  );
}

export function TraderStatChip({ icon, label, className = "" }: TraderStatChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm ${className}`.trim()}
    >
      {icon}
      {label}
    </div>
  );
}

export function TraderEmptyState({ icon, title, description, className = "" }: TraderEmptyStateProps) {
  return (
    <div className={`rounded-[30px] border border-dashed border-slate-300 bg-white px-8 py-20 text-center ${className}`.trim()}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">{icon}</div>
      <p className="mt-4 text-lg font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
    </div>
  );
}
