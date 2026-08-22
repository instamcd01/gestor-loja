import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEmpresaPorSlug } from "@/lib/catalogo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Política de entrega — ${empresa.nome}` : "Política de entrega" };
}

export default async function EntregaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-10 text-sm leading-relaxed text-black/80 dark:text-white/80">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Política de entrega</h1>
        <p className="mt-1 text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Como funciona</h2>
        <p>
          Fazemos entrega própria, calculada pela distância entre a loja e o seu endereço. A taxa e o prazo exatos
          pro seu endereço aparecem automaticamente no carrinho antes de você fechar o pedido — quanto mais perto,
          mais barato e mais rápido.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Modalidades disponíveis</h2>
        <p>No carrinho, você escolhe como quer receber:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong>Expressa</strong> — a mais rápida, entrega no mesmo dia.
          </li>
          <li>
            <strong>Econômica</strong> — mais barata, com um prazo um pouco mais longo.
          </li>
          <li>
            <strong>Agendada</strong> — você escolhe o dia e o horário que preferir.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Frete grátis</h2>
        <p>
          A partir de um valor mínimo de compra (que varia conforme a distância do seu endereço), o frete sai de
          graça — o carrinho mostra quanto falta pra desbloquear, se for o caso.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Fora da área de cobertura</h2>
        <p>
          Se o seu endereço estiver fora do alcance da nossa entrega própria, o carrinho avisa antes de você
          finalizar o pedido — nenhuma cobrança é feita nesse caso.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Prazo e atrasos</h2>
        <p>
          O prazo estimado é contado a partir da confirmação do pagamento. Imprevistos de trânsito ou volume de
          pedidos podem alterar o tempo informado — se isso acontecer, avisamos você pelos canais de contato do
          pedido.
        </p>
        <p>Se não houver ninguém no endereço pra receber, o entregador entra em contato pra combinar um novo horário.</p>
      </section>
    </article>
  );
}
