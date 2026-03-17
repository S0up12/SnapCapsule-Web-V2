import type { ReactNode } from "react";

type SettingsCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export default function SettingsCard({ eyebrow, title, description, children }: SettingsCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/20 md:p-6">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600/80 dark:text-sky-200/70">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
