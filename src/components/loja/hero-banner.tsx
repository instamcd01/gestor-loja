import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export function HeroBanner({
  nome,
  tagline,
  moderno,
}: {
  nome: string;
  tagline: string | null;
  moderno: boolean;
}) {
  if (moderno) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[color-mix(in_srgb,var(--brand-primary)_60%,black)] px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute top-6 right-16 h-24 w-24 rounded-full bg-white/8" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-white/6" />
        <div className="relative flex max-w-xl flex-col gap-4">
          <h1 className="text-3xl leading-[1.1] font-extrabold sm:text-5xl">
            Tudo para <span className="text-[var(--brand-secondary)]">seu pet</span>, entregue com carinho
          </h1>
          {tagline && <p className="max-w-md text-sm text-white/85 sm:text-base">{tagline}</p>}
          <ButtonLink
            href="#produtos"
            className="mt-2 w-fit bg-[var(--brand-secondary)] px-6 py-3.5 text-[15px] font-bold hover:opacity-90"
          >
            Ver produtos →
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
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
