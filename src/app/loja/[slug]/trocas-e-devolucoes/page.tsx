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
  return { title: empresa ? `Trocas e devoluções — ${empresa.nome}` : "Trocas e devoluções" };
}

export default async function TrocasEDevolucoesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const contato = empresa.whatsapp_catalogo
    ? `pelo WhatsApp (${empresa.whatsapp_catalogo})`
    : "pelos canais de atendimento da loja";

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-10 text-sm leading-relaxed text-black/80 dark:text-white/80">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Trocas e devoluções</h1>
        <p className="mt-1 text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Direito de arrependimento (7 dias)</h2>
        <p>
          Como sua compra foi feita fora de loja física, o Código de Defesa do Consumidor (art. 49) garante 7 dias
          corridos, a contar do recebimento do produto, para desistir da compra sem precisar justificar o motivo. O
          produto deve estar sem sinais de uso, com embalagem original. Nesse caso, você não paga nada pelo envio de
          volta, e o valor pago (incluindo frete, se houver) é reembolsado integralmente.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Produto com defeito ou diferente do pedido</h2>
        <p>
          Se o produto chegar com defeito, avariado, ou diferente do que você pediu, entre em contato {contato}{" "}
          assim que perceber o problema. Faremos a troca ou o reembolso sem custo nenhum pra você, incluindo o frete
          de devolução.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Itens não elegíveis</h2>
        <p>
          Produtos perecíveis ou já abertos/utilizados (exceto quando o motivo for defeito) não podem ser trocados
          ou devolvidos por questão de segurança sanitária — mesma regra de qualquer petshop físico.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Como solicitar</h2>
        <p>
          Chame a gente {contato} informando o número do pedido e o motivo da troca/devolução — pode ver o número na
          sua tela de{" "}
          <a href={`/loja/${slug}/pedidos`} className="underline">
            Meus Pedidos
          </a>
          . A gente combina com você a forma de devolução do produto.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Reembolso</h2>
        <p>
          O reembolso é feito pelo mesmo meio de pagamento usado na compra (Pix, cartão ou saldo/PetCash da loja),
          assim que o produto devolvido for recebido e conferido.
        </p>
      </section>
    </article>
  );
}
