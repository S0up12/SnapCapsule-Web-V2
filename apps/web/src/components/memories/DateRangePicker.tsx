import { CalendarRange, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type DatePickerMode = "range" | "from" | "until" | "day";

type DateRangeValue = {
  dateFrom: string;
  dateTo: string;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateKey(value));
}

function formatDateFilterLabel(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) {
      return formatDateKey(dateFrom);
    }
    return `${formatDateKey(dateFrom)} - ${formatDateKey(dateTo)}`;
  }
  if (dateFrom) {
    return `From ${formatDateKey(dateFrom)}`;
  }
  if (dateTo) {
    return `Until ${formatDateKey(dateTo)}`;
  }
  return "All Dates";
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0, 0);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date: Date) {
  const next = new Date(date);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
}

function endOfWeekSunday(date: Date) {
  const next = new Date(date);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() + (6 - weekday));
  return next;
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const gridStart = startOfWeekMonday(firstDay);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12, 0, 0, 0);
  const gridEnd = endOfWeekSunday(lastDay);
  const days: Date[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export default function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (next: DateRangeValue) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<DatePickerMode>("range");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    if (dateFrom) {
      return startOfMonth(parseDateKey(dateFrom));
    }
    if (dateTo) {
      return startOfMonth(parseDateKey(dateTo));
    }
    return startOfMonth(new Date());
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
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
  }, [isOpen]);

  const months = useMemo(() => [visibleMonth, addMonths(visibleMonth, 1)], [visibleMonth]);
  const normalizedFrom = dateFrom || "";
  const normalizedTo = dateTo || "";

  function handleDayClick(dayKey: string) {
    if (mode === "from") {
      onChange({ dateFrom: dayKey, dateTo: "" });
      setIsOpen(false);
      return;
    }
    if (mode === "until") {
      onChange({ dateFrom: "", dateTo: dayKey });
      setIsOpen(false);
      return;
    }
    if (mode === "day") {
      onChange({ dateFrom: dayKey, dateTo: dayKey });
      setIsOpen(false);
      return;
    }
    if (!normalizedFrom || normalizedTo) {
      onChange({ dateFrom: dayKey, dateTo: "" });
      return;
    }
    if (dayKey === normalizedFrom) {
      onChange({ dateFrom: dayKey, dateTo: dayKey });
      setIsOpen(false);
      return;
    }
    if (dayKey < normalizedFrom) {
      onChange({ dateFrom: dayKey, dateTo: normalizedFrom });
    } else {
      onChange({ dateFrom: normalizedFrom, dateTo: dayKey });
    }
    setIsOpen(false);
  }

  function isSelectedDay(dayKey: string) {
    return dayKey === normalizedFrom || dayKey === normalizedTo;
  }

  function isInRange(dayKey: string) {
    return Boolean(normalizedFrom && normalizedTo && normalizedFrom < dayKey && dayKey < normalizedTo);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-200 dark:hover:text-white"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <CalendarRange className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <span className="font-medium text-slate-900 dark:text-slate-100">{formatDateFilterLabel(dateFrom, dateTo)}</span>
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Date range filter"
          className="absolute left-0 top-[calc(100%+0.75rem)] z-30 w-[min(44rem,calc(100vw-2rem))] rounded-[1.35rem] border border-slate-200/90 bg-white/96 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-slate-950/95"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-slate-200/80 bg-slate-50/90 p-1 dark:border-white/10 dark:bg-white/[0.05]">
                {(["range", "from", "until", "day"] as DatePickerMode[]).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    onClick={() => setMode(nextMode)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition",
                      mode === nextMode
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                    ].join(" ")}
                  >
                    {nextMode === "range" ? "Range" : nextMode === "from" ? "From" : nextMode === "until" ? "Until" : "Day"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {(dateFrom || dateTo) ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ dateFrom: "", dateTo: "" });
                      setMode("range");
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {months.map((month, monthIndex) => (
                <div
                  key={`${month.getFullYear()}-${month.getMonth()}`}
                  className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibleMonth((current) => addMonths(current, monthIndex === 0 ? -1 : 1))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:text-white"
                      aria-label={monthIndex === 0 ? "Previous month" : "Next month"}
                    >
                      {monthIndex === 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month)}
                    </h3>
                    <span className="h-9 w-9" />
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {WEEKDAY_LABELS.map((weekday) => (
                      <span key={weekday} className="py-2">
                        {weekday}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {buildCalendarDays(month).map((day) => {
                      const dayKey = toDateKey(day);
                      const inMonth = day.getMonth() === month.getMonth();
                      const isSelected = isSelectedDay(dayKey);
                      const withinRange = isInRange(dayKey);

                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => handleDayClick(dayKey)}
                          className={[
                            "flex h-10 items-center justify-center rounded-full text-sm font-medium transition",
                            inMonth
                              ? "text-slate-800 hover:bg-slate-200/80 dark:text-slate-100 dark:hover:bg-white/[0.08]"
                              : "text-slate-400 hover:bg-slate-200/60 dark:text-slate-500 dark:hover:bg-white/[0.05]",
                            withinRange ? "bg-sky-100/90 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100" : "",
                            isSelected ? "bg-sky-600 text-white hover:bg-sky-600 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-400" : "",
                          ].join(" ")}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
              <span>
                {mode === "range"
                  ? "Range mode: click a start date, then an end date. Leave only the first click to filter from that day onward."
                  : mode === "from"
                    ? "From mode: pick the first day to include."
                    : mode === "until"
                      ? "Until mode: pick the last day to include."
                      : "Day mode: pick a single day."}
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatDateFilterLabel(dateFrom, dateTo)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
