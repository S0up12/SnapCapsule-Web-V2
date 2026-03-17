import {
  Archive,
  ChevronLeft,
  ChevronRight,
  House,
  MessageSquareMore,
  Settings2,
} from "lucide-react";
import { NavLink } from "react-router-dom";

type SidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
};

const navigationItems = [
  { to: "/", label: "Dashboard", icon: House, end: true },
  { to: "/chats", label: "Chats", icon: MessageSquareMore },
  { to: "/memories", label: "Memories", icon: Archive },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export default function Sidebar({
  collapsed = false,
  onNavigate,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 rounded-[1.75rem] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-lg shadow-slate-900/8 dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.35),_rgba(14,165,233,0.18),_rgba(255,255,255,0.9))] text-slate-800 shadow-inner shadow-white/20 dark:bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.35),_rgba(14,165,233,0.18),_rgba(15,23,42,0.85))] dark:text-slate-50 dark:shadow-white/10">
          <Archive className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-700/70 dark:text-sky-200/65">SnapCapsule</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Web archive workspace</p>
          </div>
        ) : null}
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-auto hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-300/20 hover:bg-sky-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white xl:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      <div className="mt-8">
        {!collapsed ? (
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Workspace
          </p>
        ) : null}

        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-3 rounded-[1.2rem] px-3 py-3 text-sm font-medium transition",
                    collapsed ? "justify-center" : "",
                    isActive
                      ? "border border-sky-300/15 bg-sky-300/[0.11] text-slate-950 shadow-[0_18px_36px_rgba(8,47,73,0.18)] dark:text-white"
                      : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.045] dark:hover:text-slate-100",
                  ].join(" ")
                }
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-slate-200 bg-white text-slate-700 transition group-hover:border-slate-300 group-hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:group-hover:border-white/15 dark:group-hover:bg-white/[0.07]">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-8 rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.82))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-200/80">Fast Path</p>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              Timeline data stays light, media stays on disk, and the viewer only asks for originals when you open them.
            </p>
          </div>

          <div className="mt-auto rounded-[1.6rem] border border-slate-200/80 bg-white/85 p-5 dark:border-white/10 dark:bg-slate-950/65">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-200/70">Current Mode</p>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              Authentication is intentionally disabled so UI and API iteration stays immediate during this phase.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
