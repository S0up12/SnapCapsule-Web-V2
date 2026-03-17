import { startTransition, useMemo, useState } from "react";
import { Database, Film, Gauge, Images, LoaderCircle } from "lucide-react";

import Lightbox from "../components/Lightbox";
import VirtualTimelineGrid from "../components/VirtualTimelineGrid";
import { useTimeline } from "../hooks/useTimeline";

function StatCard({
  label,
  value,
  icon: Icon,
  accentClassName,
}: {
  label: string;
  value: string | number;
  icon: typeof Images;
  accentClassName: string;
}) {
  return (
    <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur">
      <div className={`inline-flex rounded-2xl p-3 ${accentClassName}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </article>
  );
}

export default function Memories() {
  const {
    assets,
    total,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTimeline();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedAsset = selectedIndex !== null ? assets[selectedIndex] : null;
  const videoCount = useMemo(
    () => assets.filter((asset) => asset.media_type === "video").length,
    [assets],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,_rgba(8,16,28,0.98),_rgba(8,24,40,0.88),_rgba(4,9,16,0.98))] shadow-2xl shadow-black/30">
        <div className="grid gap-8 px-6 py-8 md:px-8 xl:grid-cols-[1.15fr_0.85fr] xl:px-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-300/70">Memories</p>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Memories
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                The archive grid streams timeline pages in batches, groups them by date, and only renders the tiles that
                are actually on screen.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <StatCard
              label="Loaded"
              value={isLoading ? "..." : assets.length}
              icon={Images}
              accentClassName="bg-cyan-400/15 text-cyan-200"
            />
            <StatCard
              label="Video Items"
              value={isLoading ? "..." : videoCount}
              icon={Film}
              accentClassName="bg-amber-300/15 text-amber-100"
            />
            <StatCard
              label="Archive Total"
              value={isLoading ? "..." : total}
              icon={Database}
              accentClassName="bg-emerald-400/15 text-emerald-200"
            />
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-[1.6rem] border border-white/10 bg-slate-950/55 px-5 py-4 shadow-xl shadow-black/20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Render Strategy</p>
          <p className="mt-2 text-sm text-slate-300">
            Virtual rows, sticky date markers, lazy thumbnails, and range-based video playback.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
          <Gauge className="h-4 w-4" />
          Performance First
        </div>
      </section>

      {isError ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error instanceof Error ? error.message : "Failed to load memories."}
        </div>
      ) : null}

      {!isError ? (
        <VirtualTimelineGrid
          assets={assets}
          total={total}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          isInitialLoading={isLoading}
          fetchNextPage={fetchNextPage}
          onOpenAsset={(index) => {
            startTransition(() => {
              setSelectedIndex(index);
            });
          }}
        />
      ) : null}

      {isFetchingNextPage && assets.length > 0 ? (
        <div className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 shadow-lg shadow-black/30 backdrop-blur">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Fetching more assets
        </div>
      ) : null}

      {selectedAsset && selectedIndex !== null ? (
        <Lightbox
          assets={assets}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={(nextIndex) => {
            if (nextIndex < 0 || nextIndex >= assets.length) {
              return;
            }
            startTransition(() => {
              setSelectedIndex(nextIndex);
            });
          }}
        />
      ) : null}
    </div>
  );
}
