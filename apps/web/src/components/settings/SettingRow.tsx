import type { ReactNode } from "react";

type SettingRowProps = {
  title: string;
  description?: string;
  children: ReactNode;
  destructive?: boolean;
};

export default function SettingRow({ title, description, children, destructive = false }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-slate-200/70 py-4 first:border-t-0 first:pt-0 dark:border-white/10 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <h3 className={`text-sm font-semibold ${destructive ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-white"}`}>
          {title}
        </h3>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
