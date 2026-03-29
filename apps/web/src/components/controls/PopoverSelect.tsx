import { ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PopoverOption = {
  value: string;
  label: string;
};

type PopoverSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: PopoverOption[];
  icon?: LucideIcon;
  disabled?: boolean;
  fullWidth?: boolean;
  minWidthClassName?: string;
};

export default function PopoverSelect({
  label,
  value,
  onChange,
  options,
  icon: Icon,
  disabled = false,
  fullWidth = false,
  minWidthClassName = "min-w-[11rem]",
}: PopoverSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen || disabled) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [disabled, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || disabled || !triggerRef.current) {
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportPadding = 12;
      const gutter = 12;
      const estimatedHeight = menuRef.current?.offsetHeight ?? Math.min(320, options.length * 44 + 16);
      const spaceBelow = window.innerHeight - rect.bottom - gutter - viewportPadding;
      const spaceAbove = rect.top - gutter - viewportPadding;
      const openUpward = spaceBelow < Math.min(estimatedHeight, 240) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        openUpward ? rect.top - gutter - viewportPadding : window.innerHeight - rect.bottom - gutter - viewportPadding,
      );
      const top = openUpward
        ? Math.max(viewportPadding, rect.top - Math.min(estimatedHeight, maxHeight) - gutter)
        : Math.min(window.innerHeight - viewportPadding - Math.min(estimatedHeight, maxHeight), rect.bottom + gutter);

      setMenuStyle({
        left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - viewportPadding - rect.width)),
        top,
        width: rect.width,
        maxHeight,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [disabled, isOpen, options.length]);

  const widthClassName = fullWidth ? "w-full" : minWidthClassName;

  return (
    <div ref={containerRef} className={["relative", fullWidth ? "w-full" : ""].join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((open) => !open);
          }
        }}
        disabled={disabled}
        className={[
          "inline-flex items-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm transition",
          "dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-200",
          "hover:border-slate-300 hover:text-slate-900 dark:hover:text-white",
          "disabled:cursor-not-allowed disabled:opacity-60",
          widthClassName,
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" /> : null}
        <span className="sr-only">{label}</span>
        <span className="min-w-0 flex-1 truncate text-left font-medium text-slate-900 dark:text-slate-100">
          {selectedOption?.label ?? label}
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400",
            isOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
        </button>

      {isOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={label}
              style={{
                position: "fixed",
                left: `${menuStyle.left}px`,
                top: `${menuStyle.top}px`,
                width: `${menuStyle.width}px`,
                maxHeight: `${menuStyle.maxHeight}px`,
              }}
              className={[
                "z-[90] overflow-y-auto rounded-[1.1rem] border border-slate-200/90 bg-white/96 p-1.5",
                "shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/95",
                fullWidth ? "" : minWidthClassName,
              ].join(" ")}
            >
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={[
                      "flex w-full items-center rounded-[0.9rem] px-3 py-2 text-left text-sm font-medium transition",
                      isActive
                        ? "bg-sky-100 text-sky-950 dark:bg-white dark:text-slate-950"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.08] dark:hover:text-white",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
