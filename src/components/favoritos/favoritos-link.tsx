"use client";

import Link from "next/link";
import { useFavoritos } from "@/components/favoritos/favoritos-provider";

/** Ícone de coração no header — link pra lista de favoritos, com contagem. */
export function FavoritosLink({ slug }: { slug: string }) {
  const { ids } = useFavoritos();

  return (
    <Link
      href={`/loja/${slug}/favoritos`}
      aria-label="Favoritos"
      title="Favoritos"
      className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.3 4.5 5.6 4c2.1-.3 4 .7 6.4 3.2C14.4 4.7 16.3 3.7 18.4 4c3.3.5 5.1 3.8 3.6 7.2-2.5 4.7-10 9.3-10 9.3Z" />
      </svg>
      {ids.size > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold text-white">
          {ids.size}
        </span>
      )}
    </Link>
  );
}
