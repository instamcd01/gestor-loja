const bloco = "animate-pulse rounded-[var(--radius-sm)] bg-black/5 dark:bg-white/10";

export default function CarregandoProduto() {
  return (
    <div className="flex flex-col gap-4">
      <div className={`h-4 w-2/3 ${bloco}`} />

      <div className="grid gap-8 md:grid-cols-2">
        <div className={`aspect-square w-full ${bloco} rounded-[var(--radius-lg)]`} />

        <div className="flex flex-col gap-4">
          <div className={`h-3 w-20 ${bloco}`} />
          <div className={`h-7 w-4/5 ${bloco}`} />
          <div className={`h-9 w-1/3 ${bloco}`} />
          <div className={`h-16 w-full ${bloco}`} />
          <div className={`h-24 w-full ${bloco} rounded-[var(--radius-lg)]`} />
        </div>
      </div>
    </div>
  );
}
