export function LoadingState() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 18 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[1.25rem] border border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.035]"
          style={{ aspectRatio: "9 / 16" }}
        />
      ))}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300/70 bg-white/65 px-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No memories match the current filter.</p>
    </div>
  );
}
