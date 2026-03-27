import { Heart, HeartOff, Tags, X } from "lucide-react";

type BulkSelectionBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onFavoriteSelected: () => Promise<void>;
  onUnfavoriteSelected: () => Promise<void>;
  onAddTags: () => void;
  onRemoveTags: () => void;
  isSaving: boolean;
};

export default function BulkSelectionBar({
  selectedCount,
  onClearSelection,
  onFavoriteSelected,
  onUnfavoriteSelected,
  onAddTags,
  onRemoveTags,
  isSaving,
}: BulkSelectionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-sky-300/20 bg-sky-400/[0.08] px-4 py-3 shadow-sm dark:border-sky-300/10 dark:bg-sky-300/[0.08]">
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-sky-300/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-900 dark:border-white/10 dark:bg-slate-950/60 dark:text-sky-100">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onFavoriteSelected()}
          className="inline-flex items-center gap-2 rounded-[1rem] border border-amber-300/20 bg-amber-400/[0.14] px-4 py-2.5 text-sm font-medium text-amber-900 transition hover:bg-amber-400/[0.2] disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-100"
        >
          <Heart className="h-4 w-4" />
          Favorite
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onUnfavoriteSelected()}
          className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:text-white"
        >
          <HeartOff className="h-4 w-4" />
          Unfavorite
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onAddTags}
          className="inline-flex items-center gap-2 rounded-[1rem] border border-emerald-300/20 bg-emerald-400/[0.14] px-4 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-400/[0.2] disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-100"
        >
          <Tags className="h-4 w-4" />
          Add Tags
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onRemoveTags}
          className="inline-flex items-center gap-2 rounded-[1rem] border border-rose-300/20 bg-rose-500/[0.12] px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-500/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-100"
        >
          <Tags className="h-4 w-4" />
          Remove Tags
        </button>
      </div>
    </div>
  );
}
