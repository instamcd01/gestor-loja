import Link from "next/link";

export function Breadcrumb({ itens }: { itens: { rotulo: string; href?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-black/50 dark:text-white/50">
      <ol className="flex flex-wrap items-center gap-1.5">
        {itens.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-[var(--brand-primary)]">
                {item.rotulo}
              </Link>
            ) : (
              <span className="line-clamp-1 text-black/70 dark:text-white/70">{item.rotulo}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
