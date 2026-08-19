import Image from "next/image";
import Link from "next/link";
import iconeCao from "@/assets/icones/cao.png";
import iconeGato from "@/assets/icones/gato.png";
import iconePassaro from "@/assets/icones/passaro.png";
import iconeOutros from "@/assets/icones/outros.png";

const CATEGORIAS = [
  { rotulo: "Cães", icone: iconeCao, params: "especie=C%C3%A3es" },
  { rotulo: "Gatos", icone: iconeGato, params: "especie=Gatos" },
  // "Pássaros" filtra por categoria (não espécie, diferente de Cães/Gatos
  // acima): o campo `especie` é texto livre e a maioria dos produtos de
  // pássaro vem com o nome específico da ave (Calopsitas e Agapornis,
  // Psitacídeos, Beija-Flor...), não a palavra genérica "Pássaros" — filtrar
  // por especie ilike '%Pássaros%' pegava só 1 de 4 produtos reais.
  // `categoria = 'Pássaros'` é 1:1 com a categoria no banco, sem esse ruído.
  { rotulo: "Pássaros", icone: iconePassaro, params: "categoria=P%C3%A1ssaros" },
  { rotulo: "Outros", icone: iconeOutros, params: "departamento=Outros%20Animais" },
] as const;

/**
 * Atalho visual pra filtrar direto por espécie/departamento de "outros animais" na home.
 *
 * Ícones importados estaticamente (em vez de servidos de public/) de propósito:
 * o Next hasheia o nome do arquivo final no build, então trocar a imagem gera
 * uma URL nova sozinho — sem isso, trocar o PNG em public/ mantinha a mesma
 * URL e o navegador/CDN continuava servindo a versão antiga em cache.
 */
export function CategoriasEspecie({ slug }: { slug: string }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4">
      {CATEGORIAS.map((c) => (
        <Link
          key={c.rotulo}
          href={`/loja/${slug}?${c.params}`}
          className="flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10"
        >
          <Image
            src={c.icone}
            alt={c.rotulo}
            width={40}
            height={40}
            className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          />
          <span className="text-xs font-semibold sm:text-sm">{c.rotulo}</span>
        </Link>
      ))}
    </div>
  );
}
