export function MarcasParceiras({ marcas }: { marcas: { marca: string; total: number }[] }) {
  const top = [...marcas].sort((a, b) => b.total - a.total).slice(0, 6);
  if (top.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] px-6 py-8 text-center">
      <h2 className="text-base font-extrabold">As melhores marcas</h2>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Trabalhamos com marcas que seu pet já conhece e confia
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {top.map((m) => (
          <span
            key={m.marca}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold dark:border-white/15 dark:bg-transparent"
          >
            {m.marca}
          </span>
        ))}
      </div>
    </div>
  );
}
