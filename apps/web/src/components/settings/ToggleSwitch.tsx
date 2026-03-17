type ToggleSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
};

export default function ToggleSwitch({ checked, onCheckedChange, disabled = false, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={[
        "relative inline-flex h-8 w-14 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-sky-400/40",
        checked
          ? "border-sky-300/30 bg-sky-400/80"
          : "border-slate-300/70 bg-slate-300/70 dark:border-white/10 dark:bg-slate-800",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-7" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}
