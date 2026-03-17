export default function Dashboard() {
  return (
    <section className="mx-auto flex w-full max-w-[1520px] flex-col gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,_rgba(10,18,30,0.98),_rgba(10,33,52,0.92),_rgba(5,10,18,0.98))] px-6 py-8 shadow-2xl shadow-black/30 md:px-8 md:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-200/70">Dashboard</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">Dashboard</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          This landing area will evolve into the operational overview for imports, processing activity, and archive health.
        </p>
      </div>
    </section>
  );
}
