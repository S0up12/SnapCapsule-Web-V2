import { Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

type TagEditorModalProps = {
  assetId: string;
  initialTags: string[];
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
};

export default function TagEditorModal({ assetId, initialTags, onClose, onSave }: TagEditorModalProps) {
  const [draftTags, setDraftTags] = useState<string[]>(() => [...initialTags]);
  const [nextTag, setNextTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function addTag() {
    const normalized = nextTag.trim();
    if (!normalized) {
      return;
    }

    setDraftTags((current) => (current.includes(normalized) ? current : [...current, normalized]));
    setNextTag("");
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(draftTags);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[1.8rem] border border-slate-200/80 bg-white/96 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950/95 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700/75 dark:text-sky-200/70">
              Asset Tags
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Edit Tags</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Asset {assetId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[1rem] border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <input
            value={nextTag}
            onChange={(event) => setNextTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag"
            className="flex-1 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={addTag}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-900 transition hover:bg-sky-400/[0.18] dark:text-sky-100"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="mt-5 flex min-h-[5rem] flex-wrap gap-2 rounded-[1.2rem] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          {draftTags.length > 0 ? (
            draftTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setDraftTags((current) => current.filter((value) => value !== tag))}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-rose-300/40 hover:text-rose-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:text-rose-200"
              >
                <span>{tag}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-500">No tags yet. Add a few to organize this memory.</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-emerald-300/20 bg-emerald-400/[0.14] px-4 py-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-400/[0.2] disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-100"
          >
            <Check className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Tags"}
          </button>
        </div>
      </div>
    </div>
  );
}
