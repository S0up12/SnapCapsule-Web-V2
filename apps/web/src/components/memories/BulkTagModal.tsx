import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BulkTagModalProps = {
  mode: "add" | "remove";
  selectedCount: number;
  availableTags: string[];
  onClose: () => void;
  onApply: (tags: string[]) => Promise<void>;
};

function normalizeTagKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function BulkTagModal({
  mode,
  selectedCount,
  availableTags,
  onClose,
  onApply,
}: BulkTagModalProps) {
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [nextTag, setNextTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const suggestionId = `bulk-tag-suggestions-${mode}`;
  const actionLabel = mode === "add" ? "Add Tags" : "Remove Tags";
  const ActionIcon = mode === "add" ? Plus : Minus;

  const sortedAvailableTags = useMemo(
    () =>
      [...availableTags]
        .filter((tag) => Boolean(normalizeTagKey(tag)))
        .sort((left, right) => left.localeCompare(right)),
    [availableTags],
  );

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

  function addTagFromValue(value: string) {
    const normalizedInput = normalizeTagKey(value);
    if (!normalizedInput) {
      return;
    }

    const canonicalTag = sortedAvailableTags.find((tag) => normalizeTagKey(tag) === normalizedInput) ?? value.trim();
    setDraftTags((current) => {
      if (current.some((tag) => normalizeTagKey(tag) === normalizedInput)) {
        return current;
      }
      return [...current, canonicalTag];
    });
    setNextTag("");
  }

  async function handleApply() {
    if (draftTags.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      await onApply(draftTags);
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
              Bulk Memory Actions
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{actionLabel}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {mode === "add"
                ? `Add tags to ${selectedCount} selected memories.`
                : `Remove tags from ${selectedCount} selected memories.`}
            </p>
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
            list={sortedAvailableTags.length > 0 ? suggestionId : undefined}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTagFromValue(nextTag);
              }
            }}
            placeholder={mode === "add" ? "Add a tag" : "Remove a tag"}
            className="flex-1 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
          />
          {sortedAvailableTags.length > 0 ? (
            <datalist id={suggestionId}>
              {sortedAvailableTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          ) : null}
          <button
            type="button"
            onClick={() => addTagFromValue(nextTag)}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-900 transition hover:bg-sky-400/[0.18] dark:text-sky-100"
          >
            <ActionIcon className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="mt-5 flex min-h-[5rem] flex-wrap gap-2 rounded-[1.2rem] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          {draftTags.length > 0 ? (
            draftTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setDraftTags((current) => current.filter((value) => normalizeTagKey(value) !== normalizeTagKey(tag)))
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:text-white"
              >
                <span>{tag}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {mode === "add"
                ? "Choose one or more tags to add across the selection."
                : "Choose one or more tags to remove across the selection."}
            </p>
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
            disabled={isSaving || draftTags.length === 0}
            onClick={() => void handleApply()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-emerald-300/20 bg-emerald-400/[0.14] px-4 py-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-400/[0.2] disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-100"
          >
            <Check className="h-4 w-4" />
            {isSaving ? "Applying..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
