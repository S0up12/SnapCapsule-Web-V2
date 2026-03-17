import { Aperture, Camera, Library, Menu, PanelLeftClose } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  {
    to: "/",
    label: "Timeline",
    icon: Library,
  },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.label}
            to={item.to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-cyan-400/15 text-white shadow-glow"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
              ].join(" ")
            }
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gallery-shell text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/65 p-6 backdrop-blur xl:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                <PanelLeftClose className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
                  SnapCapsule
                </p>
                <p className="text-sm text-slate-300">Virtual media timeline</p>
              </div>
            </div>

            <div className="mt-8">
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Navigation
              </p>
              <NavItems />
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex items-center gap-3 text-cyan-200">
                <Camera className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                  Optimized Grid
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Virtualized rendering keeps memory use flat while the timeline grows into the thousands.
              </p>
            </div>

            <div className="mt-auto rounded-[1.5rem] border border-amber-300/10 bg-amber-300/[0.06] p-5">
              <div className="flex items-center gap-3 text-amber-100">
                <Aperture className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                  Streaming Media
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-50/85">
                Full-resolution video playback uses the backend range endpoint, so seeks stay immediate.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/55 px-5 py-4 backdrop-blur xl:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
                  SnapCapsule
                </p>
                <p className="text-sm text-slate-400">Virtual gallery</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200 transition hover:bg-white/10"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>

          {mobileOpen ? (
            <div className="border-b border-white/10 bg-slate-950/95 px-5 py-5 xl:hidden">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
          ) : null}

          <main className="flex-1 px-4 py-4 md:px-6 md:py-6 xl:px-8 xl:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
