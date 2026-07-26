import { Badge } from "@/components/ui/badge";

export function HeroBanner({ nome, tagline }: { nome: string; tagline: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
      <div className="relative flex max-w-xl flex-col gap-3">
        <Badge className="w-fit bg-white/15 text-white backdrop-blur">Loja oficial</Badge>
        <h1 className="text-2xl leading-tight font-bold sm:text-4xl">
          Tudo pro seu pet, direto na {nome}
        </h1>
        {tagline && <p className="text-sm text-white/85 sm:text-base">{tagline}</p>}
      </div>
    </div>
  );
}
