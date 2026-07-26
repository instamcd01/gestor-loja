const bloco = "animate-pulse rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/10";

export default function CarregandoCatalogo() {
  return (
    <div className="flex flex-col gap-6">
      <div className={`h-44 w-full ${bloco} rounded-[var(--radius-xl)] sm:h-56`} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-14 w-full ${bloco}`} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className={`h-4 w-24 ${bloco}`} />
        <div className={`h-9 w-40 ${bloco} rounded-full`} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className={`aspect-square w-full ${bloco}`} />
            <div className={`h-3.5 w-4/5 ${bloco}`} />
            <div className={`h-3.5 w-2/5 ${bloco}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
